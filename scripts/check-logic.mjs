import assert from "node:assert/strict";

const { normalizeExternalUrl } = await import("../lib/links.ts");
const { buildSearchTerms, plainSnippet } = await import("../lib/search.ts");

const sharePointUrl =
  "https://dubaiaviationcorp.sharepoint.com/sites/CCQualityandTraining/Shared%20Documents/Forms/AllItems.aspx?id=%2Fsites%2FCCQualityandTraining%2FShared%20Documents%2FGO%20TO%20DOC%20FOLDER%2FWorldTracer%20Self%20Service%5FAn%20Overview%2Epdf&parent=%2Fsites%2FCCQualityandTraining%2FShared%20Documents%2FGO%20TO%20DOC%20FOLDER";

assert.equal(
  normalizeExternalUrl(sharePointUrl),
  "https://dubaiaviationcorp.sharepoint.com/sites/CCQualityandTraining/Shared%20Documents/GO%20TO%20DOC%20FOLDER/WorldTracer%20Self%20Service_An%20Overview.pdf"
);
assert.equal(normalizeExternalUrl("javascript:alert(1)"), null);
assert.equal(buildSearchTerms("wt bag"), "worldtracer:* & baggage:*");
assert.equal(plainSnippet("<mark>WorldTracer</mark> file"), "WorldTracer file");

const timeRangePattern = /^([01]\d|2[0-3])[:.]?([0-5]\d)\s*[-–]\s*([01]\d|2[0-3])[:.]?([0-5]\d)$/;
assert.equal(timeRangePattern.test("0800-1630"), true);
assert.equal(timeRangePattern.test("0900-2000"), true);
assert.equal(timeRangePattern.test("+7 (495) 215 1630"), false);

console.log("Logic checks passed.");
