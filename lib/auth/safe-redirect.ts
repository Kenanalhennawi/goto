// Safe redirect helper (SEC-1). Only same-origin, relative paths are ever used
// as post-login redirect targets — prevents open-redirect attacks (CWE-601).

const DEFAULT_PATH = "/";

// Returns a safe relative path ("/...") or the fallback. Rejects absolute URLs,
// protocol-relative URLs ("//evil"), schemes ("https:", "javascript:"),
// backslash tricks ("/\\evil.com") and control/whitespace characters.
export function safeRelativePath(
  value: string | null | undefined,
  fallback: string = DEFAULT_PATH
): string {
  if (typeof value !== "string") return fallback;
  const candidate = value.trim();
  if (!candidate.startsWith("/")) return fallback;
  if (candidate.startsWith("//")) return fallback;
  if (candidate.includes("\\")) return fallback;
  if (candidate.includes(":")) return fallback;
  for (let i = 0; i < candidate.length; i++) {
    const code = candidate.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f) return fallback;
  }
  return candidate;
}
