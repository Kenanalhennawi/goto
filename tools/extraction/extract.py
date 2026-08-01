#!/usr/bin/env python3
"""
GO TO manual chapter extractor (UPD-2.1).

Deterministic, offline, no AI. Converts the operational PDF into the versioned
extraction contract consumed by the sync worker.

Usage:
    python extract.py <input.pdf> <output-dir>

All paths are command-line arguments; nothing is hard-coded. Output is written
to <output-dir>/chapters.json following the contract in ../../lib/extraction-contract.ts

Requires poppler-utils (pdftotext, pdfinfo) on PATH.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
from datetime import datetime
from typing import Any

EXTRACTOR_VERSION = "upd2-1"

# Windows consoles default to cp1252, which cannot encode text extracted from
# the manual. Force UTF-8 on our own streams so reporting never crashes.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(encoding="utf-8", errors="replace")
    except (AttributeError, ValueError):  # pragma: no cover - older interpreters
        pass

# Chapter headings look like:  "        29. Firearms and Carry of Ammunition"
# Sub-chapters ("29.1 ...") are body content, not separate chapters.
CHAPTER_RE = re.compile(r"^[ \t]*(\d{1,3})\.\s+([A-Z][^\n]{2,120})$")
# Search-keyword line emitted under a heading: "(SK: Firearm,, Firearms,,)"
SK_RE = re.compile(r"\(SK:\s*(.*?)\)", re.S)
# Title page: "Version 81.7 30-Jul-2026"
VERSION_RE = re.compile(r"Version\s+(\d+\.\d+)\s+(\d{1,2}-[A-Za-z]{3}-\d{4})")
FOOTER_RE = re.compile(r"^\s*copyright flydubai.*?Page\.\s*\d+\s*$", re.I | re.M)


class ExtractionError(Exception):
    """Carries a stable machine-readable code alongside the message."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def fail(code: str, message: str) -> None:
    """Emit a machine-readable error and exit non-zero."""
    print(json.dumps({"error": code, "message": message}), file=sys.stderr)
    sys.exit(2)


def run(cmd: list[str]) -> str:
    """Run a binary with an ARGUMENT ARRAY. Never shell=True.

    The output is ALWAYS decoded as UTF-8 with errors="replace". Without the
    explicit encoding, Python falls back to locale.getpreferredencoding(),
    which is cp1252 on Windows and raises UnicodeDecodeError on bytes such as
    0x9d that legitimately occur in the manual's text layer.
    """
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=600,
            check=False,
        )
    except FileNotFoundError:
        raise ExtractionError("MISSING_DEPENDENCY", f"{cmd[0]} is not installed")
    except subprocess.TimeoutExpired:
        raise ExtractionError("EXTRACTION_TIMEOUT", f"{cmd[0]} timed out")

    if result.returncode != 0:
        raise ExtractionError("EXTRACTION_FAILED", f"{cmd[0]} exited {result.returncode}")

    # Never return None: downstream callers immediately .split() the result.
    if result.stdout is None:
        raise ExtractionError("EMPTY_OUTPUT", f"{cmd[0]} returned no text")

    return result.stdout


def sha256_of(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def page_count(pdf_path: str) -> int:
    info = run(["pdfinfo", pdf_path])
    if info is None:
        raise ExtractionError("EMPTY_OUTPUT", "pdfinfo returned no text")
    match = re.search(r"^Pages:\s+(\d+)", info, re.M)
    if not match:
        raise ExtractionError("INVALID_PDF", "Could not read the page count")
    return int(match.group(1))


def pdf_pages_text(pdf_path: str) -> list[str]:
    """Layout-preserved text, one entry per page.

    pdftotext terminates the final page with a form feed, so a naive split
    yields a trailing empty element. Dropping it keeps len(pages) equal to the
    real page count — otherwise the last chapter's pageEnd overshoots and the
    extraction contract (correctly) rejects the output.
    """
    text = run(["pdftotext", "-layout", pdf_path, "-"])
    # Guard before split(): a missing text layer must surface as a proper
    # extraction error, never as AttributeError on None.
    if text is None:
        raise ExtractionError("EMPTY_OUTPUT", "pdftotext returned no text")
    if not text.strip():
        raise ExtractionError("NO_TEXT_LAYER", "pdftotext returned an empty text layer")

    pages = text.split("\f")
    while pages and not pages[-1].strip():
        pages.pop()
    if not pages:
        raise ExtractionError("NO_TEXT_LAYER", "pdftotext returned no readable pages")
    return pages


def parse_version(first_pages: list[str]) -> tuple[str | None, str | None, str | None]:
    """Return (title, version, iso_date) parsed from the title page."""
    joined = "\n".join(first_pages[:2])
    match = VERSION_RE.search(joined)
    version = match.group(1) if match else None
    iso_date = None
    if match:
        try:
            iso_date = datetime.strptime(match.group(2), "%d-%b-%Y").date().isoformat()
        except ValueError:
            iso_date = None
    lines = [line.strip() for line in first_pages[0].splitlines() if line.strip()]
    title = " ".join(lines[:3])[:200] if lines else None
    return title, version, iso_date


def slugify(text: str) -> str:
    """Must match slugifyChapter() in lib/sync-identity.ts."""
    value = text.lower().strip()
    value = re.sub(r"[^\w\s-]", "", value)
    value = re.sub(r"[\s_-]+", "-", value)
    return re.sub(r"^-+|-+$", "", value)[:80]


def clean_body(raw: str) -> str:
    body = FOOTER_RE.sub("", raw)
    body = SK_RE.sub("", body)
    return re.sub(r"\n{3,}", "\n\n", body).strip()


def keywords_from(raw: str) -> list[str]:
    match = SK_RE.search(raw)
    if not match:
        return []
    parts = [p.strip() for p in match.group(1).replace(",,", ",").split(",")]
    seen: list[str] = []
    for part in parts:
        if part and part.lower() not in [s.lower() for s in seen]:
            seen.append(part)
    return seen[:40]


def extract_chapters(pages: list[str]) -> list[dict[str, Any]]:
    """Locate chapter headings, then slice body text between them."""
    starts: list[tuple[int, str, str]] = []  # (page_index, number, title)
    for index, page in enumerate(pages):
        for line in page.splitlines():
            match = CHAPTER_RE.match(line.rstrip())
            if not match:
                continue
            number, title = match.group(1), match.group(2).strip()
            # Ignore table-of-contents rows ("29. Firearms .......... 130").
            if re.search(r"\.{4,}\s*\d+\s*$", title):
                continue
            starts.append((index, number, title))

    # De-duplicate: keep the FIRST occurrence of each chapter number.
    seen_numbers: set[str] = set()
    unique: list[tuple[int, str, str]] = []
    for entry in starts:
        if entry[1] in seen_numbers:
            continue
        seen_numbers.add(entry[1])
        unique.append(entry)

    chapters: list[dict[str, Any]] = []
    for position, (page_index, number, title) in enumerate(unique):
        end_index = unique[position + 1][0] - 1 if position + 1 < len(unique) else len(pages) - 1
        if end_index < page_index:
            end_index = page_index
        raw = "\n".join(pages[page_index : end_index + 1])
        full_title = f"{number}. {title}"
        chapters.append(
            {
                "chapterNumber": number,
                "title": full_title,
                "slug": slugify(full_title),
                "pageStart": page_index + 1,
                "pageEnd": end_index + 1,
                "body": clean_body(raw),
                "contentBlocks": [],
                "searchKeywords": keywords_from(raw),
                "sourceLinks": [],
            }
        )
    return chapters


def main() -> None:
    if len(sys.argv) != 3:
        fail("USAGE", "usage: extract.py <input.pdf> <output-dir>")

    pdf_path = os.path.abspath(sys.argv[1])
    out_dir = os.path.abspath(sys.argv[2])

    if not os.path.isfile(pdf_path):
        fail("INPUT_NOT_FOUND", "Input PDF does not exist")
    with open(pdf_path, "rb") as handle:
        if handle.read(5) != b"%PDF-":
            fail("INVALID_PDF", "File is not a PDF")

    os.makedirs(out_dir, exist_ok=True)

    pages = pdf_pages_text(pdf_path)
    title, version, version_date = parse_version(pages)
    chapters = extract_chapters(pages)

    if not chapters:
        fail("NO_CHAPTERS", "No chapters were detected in the PDF")

    payload = {
        "extractorVersion": EXTRACTOR_VERSION,
        "source": {
            "title": title,
            "version": version,
            "versionDate": version_date,
            "pageCount": page_count(pdf_path),
            "sha256": sha256_of(pdf_path),
        },
        "chapters": chapters,
    }

    out_path = os.path.join(out_dir, "chapters.json")
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "chapters": len(chapters), "output": out_path}))


if __name__ == "__main__":
    # Any ExtractionError becomes the same machine-readable {"error": CODE}
    # contract the worker already parses — never a raw Python traceback.
    try:
        main()
    except ExtractionError as error:
        fail(error.code, error.message)
