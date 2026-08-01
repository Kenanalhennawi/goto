# Extraction tools

Deterministic, offline PDF extraction for the GO TO manual. No AI, no network,
no external document APIs.

| Script | Purpose |
|---|---|
| `extract.py` | PDF → `chapters.json` (versioned extraction contract) |
| `attach_pdf_links.py` | Enriches `chapters.json` with per-page anchors and referenced attachments |

## Usage

```bash
python tools/extraction/extract.py <input.pdf> <output-dir>
python tools/extraction/attach_pdf_links.py <input.pdf> <output-dir>
# -> <output-dir>/chapters.json
```

All paths are command-line arguments — nothing is hard-coded, and no Windows
machine paths are referenced. Both scripts invoke poppler with **argument
arrays** (`subprocess.run([...])`), never `shell=True`.

## Dependencies

Python 3.11+ standard library only, plus `poppler-utils` (`pdftotext`,
`pdfinfo`) on `PATH`. See `requirements.txt`.

## Output contract

Validated by `lib/extraction-contract.ts` before any staged row is written.
Malformed output is rejected and the run fails with `INVALID_EXTRACTOR_OUTPUT`.

```json
{
  "extractorVersion": "upd2-1",
  "source": { "title": "...", "version": "81.7", "versionDate": "2026-07-30",
              "pageCount": 356, "sha256": "..." },
  "chapters": [{ "chapterNumber": "29", "title": "...", "slug": "...",
                 "pageStart": 130, "pageEnd": 132, "body": "...",
                 "contentBlocks": [], "searchKeywords": [], "sourceLinks": [] }]
}
```

Bump `EXTRACTOR_VERSION` in `extract.py` **and** `lib/sync-upload.ts` together
whenever parsing changes, so runs stay reproducible.

## Note on provenance

The original `extract.py` / `attach_pdf_links.py` lived outside the repository
(`C:\goto-manual-project\...`), which no longer exists. These scripts are a
portable reimplementation of the same contract, verified against
GO TO v81.7 (356 pages): they reproduce the chapter boundaries used by the
UPD-1 audit (ch.28 pp.126-129, ch.29 pp.130-132, ch.34 p.163, ch.35 pp.164-169,
ch.43 p.257). Compare a staged run against the live chapters before publishing.
