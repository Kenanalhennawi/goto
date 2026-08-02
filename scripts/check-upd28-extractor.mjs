// UPD-2.8 — chapter heading detection + inline-SK title cleanup.
// Run with: node scripts/check-upd28-extractor.mjs
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const extractPy = readFileSync(join(root, "tools/extraction/extract.py"), "utf8");
const { slugifyChapter, stripChapterNumberPrefix } = await import("../lib/sync-identity.ts");

// ===========================================================================
// 1. Parser rules are present and correctly ordered
// ===========================================================================
// (a) The [A-Z] anchor that dropped chapters 60/68/81 must be gone.
assert.ok(
  /CHAPTER_RE = re\.compile\(r"\^\[ \\t\]\*\(\\d\{1,3\}\)\\\.\\s\+\(\\S/.test(extractPy),
  "heading regex must accept a non-space (lowercase) title start"
);
assert.ok(!/\(\[A-Z\]\[\^\\n\]\{2,120\}\)/.test(extractPy), "the [A-Z] title anchor must be removed");

// (b) Inline SK is cut from the TITLE only, via a marker-specific rule.
assert.ok(/SK_INLINE_RE = re\.compile\(r"\\s\*\\\(\?\\s\*SK:/.test(extractPy), "inline SK rule required");
assert.ok(/title = SK_INLINE_RE\.sub\("", title\)\.strip\(\)/.test(extractPy), "title must be SK-stripped");
// Arbitrary parentheses must NOT be stripped globally.
assert.ok(!/re\.sub\(r"\\\([^"]*\\\)"[^)]*, ""/.test(extractPy), "must not strip arbitrary parentheses");

// (c) TOC rejection and first-occurrence de-duplication are intact, and the
//     TOC check runs BEFORE the SK cut (otherwise chapter 58's TOC row would
//     lose its dotted leader and win first-occurrence).
assert.ok(/\\\.\{4,\}\\s\*\\d\+\\s\*\$/.test(extractPy), "dotted-leader TOC guard must remain");
assert.ok(/keep the FIRST occurrence/i.test(extractPy), "first-occurrence de-duplication must remain");
const detectBlock = extractPy.slice(
  extractPy.indexOf("for index, page in enumerate(pages)"),
  extractPy.indexOf("starts.append(")
);
assert.ok(
  detectBlock.indexOf("\\.{4,}") < detectBlock.indexOf("SK_INLINE_RE"),
  "TOC rejection must be evaluated before the SK cut"
);

// (d) Production slug behaviour unchanged.
assert.ok(/re\.sub\(r"\[\\s_\]\+", "-", value\)/.test(extractPy), "hyphens must not be collapsed");
assert.ok(/return value\[:60\]/.test(extractPy), "60-character truncation must remain");
assert.ok(!/\^-\+\|-\+\$/.test(extractPy), "leading/trailing dashes must not be trimmed");

// (e) Continuity diagnostics exist and never hard-fail on a gap.
assert.ok(/def chapter_continuity\(/.test(extractPy), "continuity diagnostics required");
for (const key of ["detected", "missing", "duplicates", "decimalOrRangeHeadings", "pageOrderMonotonic"]) {
  assert.ok(extractPy.includes(`"${key}"`), `continuity must report ${key}`);
}
assert.ok(
  /never treated as an automatic failure/i.test(extractPy),
  "a missing number must be reported, not fatal"
);
// The continuity function itself must never raise — a gap is data, not an error.
const continuityFn = extractPy.slice(
  extractPy.indexOf("def chapter_continuity("),
  extractPy.indexOf("def main()")
);
assert.ok(continuityFn.length > 0, "continuity function must exist");
assert.ok(!/\braise\b/.test(continuityFn), "a reported gap must never raise");

// ===========================================================================
// 2. Synthetic PDF-free fixture: run the parser's own functions
// ===========================================================================
const PY = `
import json, sys
sys.path.insert(0, ${JSON.stringify(join(root, "tools/extraction"))})
import extract
pages = [
  # p1: heading with INLINE SK metadata (chapter 58 shape)
  "           58. Upgrade to Business Class (SK: UG,, Upgrade,, Up,, Bid,, Bidding,,)\\nbody fifty eight\\n",
  # p2: lowercase brand heading (chapter 60 shape)
  "           60. flydubai MobileApp\\nbody sixty\\n",
  # p3: lowercase heading WITH legitimate parentheses (chapter 68 shape)
  "            68. eShop by flydubai (Suspended until further notice).\\nbody sixty eight\\n",
  # p4: heading immediately after body text, at a page boundary
  "trailing body from the previous chapter\\n           70. Government Deals\\nbody seventy\\n",
  # p5: FINAL page heading (EOF flush, chapter 81 shape)
  "           81. flydubai Partner Inquiries \u2013 Travel Agencies\\nbody eighty one\\n",
]
chapters = extract.extract_chapters(pages)
out = [{"n": c["chapterNumber"], "title": c["title"], "slug": c["slug"],
        "ps": c["pageStart"], "pe": c["pageEnd"]} for c in chapters]
print(json.dumps({"chapters": out, "continuity": extract.chapter_continuity(chapters, pages)}))
`;
const dir = mkdtempSync(join(tmpdir(), "upd28-"));
let fixture;
try {
  const script = join(dir, "fx.py");
  writeFileSync(script, PY);
  fixture = JSON.parse(execFileSync("python3", [script], { encoding: "utf8" }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const byNum = Object.fromEntries(fixture.chapters.map((c) => [c.n, c]));

// Chapter 58: inline SK removed from the title AND the slug.
assert.equal(byNum["58"].title, "58. Upgrade to Business Class", "inline SK must not enter the title");
assert.equal(byNum["58"].slug, "upgrade-to-business-class", "inline SK must not enter the slug");
assert.ok(!byNum["58"].slug.includes("sk-"), "slug must not carry SK tokens");

// Chapter 60: lowercase brand heading is detected.
assert.equal(byNum["60"].title, "60. flydubai MobileApp");
assert.equal(byNum["60"].slug, "flydubai-mobileapp");

// Chapter 68: lowercase heading whose parentheses are legitimate.
assert.equal(byNum["68"].title, "68. eShop by flydubai (Suspended until further notice).");
assert.equal(byNum["68"].slug, "eshop-by-flydubai-suspended-until-further-notice");

// Chapter 70: heading that follows body text at a page boundary.
assert.equal(byNum["70"].title, "70. Government Deals");
assert.equal(byNum["70"].slug, "government-deals");

// Chapter 81: final-page heading is flushed at EOF with a valid range.
assert.equal(byNum["81"].title, "81. flydubai Partner Inquiries \u2013 Travel Agencies");
assert.equal(byNum["81"].slug, "flydubai-partner-inquiries-travel-agencies");
assert.equal(byNum["81"].pe, 5, "the final chapter must extend to the last page");
assert.ok(byNum["81"].pe >= byNum["81"].ps, "final page range must be valid");

// Page ranges are ordered and non-overlapping-by-construction.
for (const c of fixture.chapters) assert.ok(c.pe >= c.ps, `ch${c.n} page range`);
assert.equal(fixture.continuity.pageOrderMonotonic, true, "page order must be monotonic");

// Continuity reports the gaps without failing (58,60,68,70,81 -> many gaps).
assert.equal(fixture.continuity.detectedCount, 5);
assert.ok(fixture.continuity.missing.length > 0, "gaps must be reported");
assert.deepEqual(fixture.continuity.duplicates, [], "no duplicates in the fixture");

// ===========================================================================
// 3. Slug behaviour preserved (TypeScript side stays in lock-step)
// ===========================================================================
assert.equal(
  slugifyChapter(stripChapterNumberPrefix("39. SSR - Special Requests")),
  "ssr---special-requests",
  "SSR slug behaviour must be unchanged"
);
assert.equal(slugifyChapter(stripChapterNumberPrefix("60. flydubai MobileApp")), "flydubai-mobileapp");
assert.equal(
  slugifyChapter(stripChapterNumberPrefix("68. eShop by flydubai (Suspended until further notice).")),
  "eshop-by-flydubai-suspended-until-further-notice"
);
assert.equal(
  slugifyChapter(stripChapterNumberPrefix("81. flydubai Partner Inquiries – Travel Agencies")),
  "flydubai-partner-inquiries-travel-agencies"
);

// ===========================================================================
// 4. Duplicate-slug rejection still fails safely
// ===========================================================================
const { validateExtractionContract } = await import("../lib/extraction-contract.ts");
const ch = (slug, title) => ({
  chapterNumber: "1", title, slug, pageStart: 1, pageEnd: 1,
  body: "b", contentBlocks: [], searchKeywords: [], sourceLinks: [],
});
const dup = validateExtractionContract({
  extractorVersion: "upd2-1",
  source: { title: "t", version: "81.7", versionDate: "2026-07-30", pageCount: 5, sha256: "a".repeat(64) },
  chapters: [ch("same", "A"), ch("same", "B")],
});
assert.equal(dup.ok, false);
assert.equal(dup.errorCode, "DUPLICATE_SLUG", "duplicate slugs must be rejected, never merged");

console.log("UPD-2.8 extractor checks passed.");
