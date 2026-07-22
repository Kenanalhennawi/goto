// Build-time decision-tree structural validation.
// Run: node scripts/validate-trees.mjs
// Exits non-zero if any tree has a structural error. Also imported by
// scripts/check-decision.mjs so it runs in the standard verification pipeline.

const { DECISION_DEFINITIONS } = await import("../lib/decision-engine/definitions/index.ts");
const { validateAllTrees, treeErrors } = await import("../lib/decision-engine/validate-trees.ts");

const issues = validateAllTrees(DECISION_DEFINITIONS);
const errors = treeErrors(issues);
const warnings = issues.filter((issue) => issue.level === "warning");

for (const issue of issues) {
  const tag = issue.level === "error" ? "ERROR" : "warn";
  console.log(`[${tag}] ${issue.slug}: ${issue.message}`);
}

console.log(
  `Tree validation: ${Object.keys(DECISION_DEFINITIONS).length} workflows, ` +
    `${errors.length} error(s), ${warnings.length} warning(s).`
);

if (errors.length > 0) {
  process.exitCode = 1;
} else {
  console.log("Tree validation passed.");
}
