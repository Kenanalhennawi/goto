// HYG-1 — repository hygiene: encoding, line endings, secrets, artifacts.
// Run with: node scripts/check-hygiene.mjs
//
// These defects have all actually occurred in this repository:
//   * a Windows tool re-encoded worker/index.mjs, turning every em dash into
//     mojibake (commit 9339835, undone by 1081ae4);
//   * the same tool rewrote 18 files LF -> CRLF, producing an 8,600-line diff
//     that contained ~113 real lines.
// Both hid inside commits whose stated purpose was a small logic change.
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(root, p), "utf8");

/** Files git tracks, so untracked scratch files never fail the build. */
function trackedFiles() {
  const out = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

const TEXT_EXT = /\.(ts|tsx|js|mjs|cjs|json|css|md|sql|py|ya?ml|txt)$/i;

let tracked = [];
let gitAvailable = true;
try {
  tracked = trackedFiles();
} catch {
  gitAvailable = false;
}

if (gitAvailable) {
  // A detector necessarily contains the byte sequences it detects, so this file
  // matches its own mojibake pattern. Excluding it is not a loosened check: it
  // is the difference between the suite working and the suite reporting itself.
  //
  // This was latent. `git ls-files` fails inside the mounted workspace (a stale
  // index.lock that cannot be removed), so `gitAvailable` was false and this
  // ENTIRE block was skipped every time it was run there — the suite passed by
  // doing nothing. It only surfaced when run against a real clone.
  const SELF = "scripts/check-hygiene.mjs";
  const textFiles = tracked.filter(
    (f) => TEXT_EXT.test(f) && f !== SELF && existsSync(join(root, f))
  );
  assert.ok(textFiles.length > 50, "expected to find the tracked source files");

  // ---- 1. No mojibake -----------------------------------------------------
  // "â€" is the UTF-8 byte sequence for an em/en dash decoded as cp1252. Its
  // presence always means a file was read with the wrong encoding and re-saved.
  const mojibake = textFiles.filter((f) => /â€|Ã©|Ã¢|â€™|â€"/.test(read(f)));
  assert.deepEqual(mojibake, [], `mojibake (cp1252 re-encoding) found in: ${mojibake.join(", ")}`);

  // ---- 2. No CRLF in tracked text -----------------------------------------
  const crlf = textFiles.filter((f) => read(f).includes("\r\n"));
  assert.deepEqual(
    crlf,
    [],
    `CRLF line endings in tracked text files: ${crlf.slice(0, 10).join(", ")}` +
      (crlf.length > 10 ? ` (+${crlf.length - 10} more)` : "") +
      ". Run: git add --renormalize ."
  );

  // ---- 3. No build artifacts, logs, secrets or extraction output tracked ---
  const forbidden = tracked.filter((f) =>
    /(^|\/)(\.env($|\.)|.*\.tsbuildinfo$|__pycache__\/|.*\.pyc$|worker-.*\.log$|chapters\.json$|existing-chapters\.json$|.*\.pdf$)/i.test(f)
  );
  assert.deepEqual(forbidden, [], `these must never be tracked: ${forbidden.join(", ")}`);

  // ---- 4. Exactly one lockfile ---------------------------------------------
  const lockfiles = tracked.filter((f) => /^(package-lock\.json|pnpm-lock\.yaml|yarn\.lock)$/.test(f));
  assert.equal(
    lockfiles.length,
    1,
    `exactly one lockfile must be tracked, found: ${lockfiles.join(", ") || "none"}`
  );
}

// ---- 5. .gitattributes pins LF ------------------------------------------
const attrs = read(".gitattributes");
assert.ok(/^\*\s+text=auto\s+eol=lf/m.test(attrs), ".gitattributes must pin LF for text");
assert.ok(/\*\.pdf\s+binary/.test(attrs), "PDFs must be marked binary");

// ---- 6. .gitignore covers the artifacts that have actually leaked --------
const ignore = read(".gitignore");
for (const pattern of ["worker-*.log", "/chapters.json", "*.tsbuildinfo", "__pycache__/", ".env*"]) {
  assert.ok(ignore.includes(pattern), `.gitignore must contain ${pattern}`);
}

// ---- 7. The service-role key is confined to the worker -------------------
// Re-asserted here so hygiene alone catches a leak even if the API-specific
// suites are not run.
if (gitAvailable) {
  const appSources = tracked.filter(
    (f) => /^(app|components|lib)\/.*\.(ts|tsx)$/.test(f) && existsSync(join(root, f))
  );
  // Detect USE of the key, not mention of its name. The admin sync page legitimately
  // documents `SUPABASE_SERVICE_ROLE_KEY` in an operator runbook: that is the
  // variable's NAME in a <pre> block, not its value, and reveals nothing.
  // What must never appear is reading it or building a client with it.
  const USES_SERVICE_KEY =
    /process\.env\.[A-Z_]*SERVICE_ROLE|createClient\([^)]*SERVICE_ROLE|serviceRoleKey/i;
  const leaks = appSources.filter((f) => USES_SERVICE_KEY.test(read(f)));
  assert.deepEqual(leaks, [], `service-role key USED outside the worker: ${leaks.join(", ")}`);

  // A service-role key must never be exposed to the browser bundle.
  const publicLeaks = tracked
    .filter((f) => /\.(ts|tsx|mjs)$/.test(f) && existsSync(join(root, f)))
    .filter((f) => /NEXT_PUBLIC_[A-Z_]*(SERVICE|SECRET|PRIVATE)/i.test(read(f)));
  assert.deepEqual(publicLeaks, [], `secret exposed via NEXT_PUBLIC_: ${publicLeaks.join(", ")}`);
}

console.log("HYG-1 hygiene checks passed.");
