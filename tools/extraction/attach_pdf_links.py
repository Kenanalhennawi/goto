#!/usr/bin/env python3
"""
Attach source page references to extracted chapters (UPD-2.1).

Usage:
    python attach_pdf_links.py <input.pdf> <output-dir>

Reads <output-dir>/chapters.json produced by extract.py and enriches each
chapter with `sourceLinks` — deterministic page anchors used by the app to link
an agent back to the exact page of the manual. Deterministic, offline, no AI.

Requires poppler-utils (pdftotext) on PATH.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys

# "26.3 TV Carriage Limitations.xls" / "(click me to view file)" style callouts.
ATTACHMENT_RE = re.compile(r"([A-Za-z0-9_\-. ]+\.(?:pdf|xls|xlsx|docx?|pptx?))", re.I)


def fail(code: str, message: str) -> None:
    print(json.dumps({"error": code, "message": message}), file=sys.stderr)
    sys.exit(2)


def run(cmd: list[str]) -> str:
    """Run a binary with an ARGUMENT ARRAY. Never shell=True."""
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=600, check=False)
    except FileNotFoundError:
        fail("MISSING_DEPENDENCY", f"{cmd[0]} is not installed")
    except subprocess.TimeoutExpired:
        fail("EXTRACTION_TIMEOUT", f"{cmd[0]} timed out")
    if result.returncode != 0:
        fail("EXTRACTION_FAILED", f"{cmd[0]} exited {result.returncode}")
    return result.stdout


def main() -> None:
    if len(sys.argv) != 3:
        fail("USAGE", "usage: attach_pdf_links.py <input.pdf> <output-dir>")

    pdf_path = os.path.abspath(sys.argv[1])
    out_dir = os.path.abspath(sys.argv[2])
    chapters_path = os.path.join(out_dir, "chapters.json")

    if not os.path.isfile(pdf_path):
        fail("INPUT_NOT_FOUND", "Input PDF does not exist")
    if not os.path.isfile(chapters_path):
        fail("CONTRACT_NOT_FOUND", "chapters.json not found; run extract.py first")

    with open(chapters_path, "r", encoding="utf-8") as handle:
        payload = json.load(handle)

    pages = run(["pdftotext", "-layout", pdf_path, "-"]).split("\f")
    total_pages = len(pages)

    for chapter in payload.get("chapters", []):
        start = int(chapter.get("pageStart") or 0)
        end = int(chapter.get("pageEnd") or start)
        links: list[dict[str, object]] = []

        # 1. One anchor per page of the chapter.
        for page in range(start, min(end, total_pages) + 1):
            if page < 1:
                continue
            links.append({"type": "page", "page": page, "label": f"Page {page}"})

        # 2. Referenced attachments named in the chapter body.
        body_pages = pages[max(start - 1, 0) : min(end, total_pages)]
        names: list[str] = []
        for name in ATTACHMENT_RE.findall("\n".join(body_pages)):
            cleaned = name.strip()
            if cleaned and cleaned.lower() not in [n.lower() for n in names]:
                names.append(cleaned)
        for name in names[:10]:
            links.append({"type": "attachment", "page": start, "label": name})

        chapter["sourceLinks"] = links[:60]

    with open(chapters_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)

    print(json.dumps({"ok": True, "chapters": len(payload.get("chapters", []))}))


if __name__ == "__main__":
    main()
