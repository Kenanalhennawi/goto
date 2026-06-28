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

const travelAgentList =
  "Smart Travel 97165313533 Visachange@smarttravels.ae Clear Tour 97142955262 Mishal@dahrtours.com Travelers Choice 97165279272 malik@travellerschoice.ae Arooha 97142399903 shj@aroohatours.com Go Kite +971 42 386 066 a2a@kite.travel Hadaf +971 42 522486 ticketing@alhadaftourism.com Akbar +971 4356 1133 aegroupdesk@akbargulf.com Note the important points below, Visa change flights are applicable to MCT, KWI & BAH.";
const suppressedNames = [
  "smart travel",
  "clear tour",
  "travelers choice",
  "arooha",
  "go kite",
  "princess travel",
  "smart trip",
  "nawi saadi",
  "khyber",
  "hadaf",
  "akbar",
];
assert.equal(
  suppressedNames.filter((name) => travelAgentList.toLowerCase().includes(name)).length >= 5 &&
    travelAgentList.toLowerCase().includes("visa change flights"),
  true
);

console.log("Logic checks passed.");
