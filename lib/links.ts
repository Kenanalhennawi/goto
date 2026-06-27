const SAFE_URL_PATTERN = /^(https?:|mailto:|tel:)/i;

export function isSafeExternalUrl(url: string) {
  return SAFE_URL_PATTERN.test(url.trim());
}

export function normalizeExternalUrl(url: string) {
  const trimmed = url.trim();
  if (!isSafeExternalUrl(trimmed)) return null;

  return normalizeSharePointFileUrl(trimmed) ?? trimmed;
}

function normalizeSharePointFileUrl(url: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (!parsed.hostname.toLowerCase().includes("sharepoint.com")) return null;
  if (!parsed.pathname.toLowerCase().endsWith("/forms/allitems.aspx")) return null;

  const filePath = parsed.searchParams.get("id");
  if (!filePath) return null;

  const decodedPath = decodeURIComponent(filePath);
  if (!/\.(pdf|pptx?|docx?|xlsx?)$/i.test(decodedPath)) return null;

  return `${parsed.origin}${encodeUriPath(decodedPath)}`;
}

function encodeUriPath(path: string) {
  return path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");
}
