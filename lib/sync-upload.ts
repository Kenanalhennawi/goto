// UPD-2: shared upload contract for the PDF Update Studio.
// Pure validation helpers so the API route, the Admin UI and the tests agree.

export const MANUAL_SOURCES_BUCKET = "manual-sources";
export const MAX_PDF_BYTES = 40 * 1024 * 1024; // 40 MB
export const ACCEPTED_MIME = "application/pdf";
/** Bump when the extraction pipeline changes, so runs stay reproducible. */
export const EXTRACTOR_VERSION = "upd2-1";

export type UploadRequest = {
  fileName: string;
  fileSize: number;
  mimeType: string;
};

export type UploadValidation =
  | { ok: true; value: UploadRequest }
  | { ok: false; error: string; errorCode: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** Reject anything that is not a plausible, in-limit PDF before signing a URL. */
export function validateUploadRequest(body: unknown): UploadValidation {
  if (!isRecord(body)) {
    return { ok: false, error: "Invalid upload request.", errorCode: "INVALID_BODY" };
  }

  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : NaN;
  const mimeType = typeof body.mimeType === "string" ? body.mimeType.trim() : "";

  if (!fileName || fileName.length > 200) {
    return { ok: false, error: "Provide a valid file name.", errorCode: "INVALID_FILENAME" };
  }
  if (!/\.pdf$/i.test(fileName)) {
    return { ok: false, error: "Only PDF files are accepted.", errorCode: "INVALID_EXTENSION" };
  }
  if (mimeType !== ACCEPTED_MIME) {
    return { ok: false, error: "Only PDF files are accepted.", errorCode: "INVALID_MIME" };
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return { ok: false, error: "The file appears to be empty.", errorCode: "EMPTY_FILE" };
  }
  if (fileSize > MAX_PDF_BYTES) {
    return { ok: false, error: "The PDF is larger than the 40 MB limit.", errorCode: "FILE_TOO_LARGE" };
  }

  return { ok: true, value: { fileName, fileSize, mimeType } };
}

/**
 * Storage key for a freshly uploaded file, BEFORE its version/hash are known.
 * The worker re-keys it to v{version}/{sha256}.pdf once validated.
 * The filename is never interpolated into a shell command; it is sanitised to
 * a safe slug so a hostile name cannot escape the storage prefix.
 */
export function pendingUploadPath(userId: string, fileName: string): string {
  const safe = fileName
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "manual";
  const stamp = new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14);
  return `pending/${userId}/${stamp}-${safe}.pdf`;
}

/**
 * Canonical archive key once the worker knows the version and hash.
 * The version is reduced to digits and single dots, with leading/trailing and
 * repeated dots removed, so no input can produce a ".." path segment.
 */
export function archivedPdfPath(version: string, sha256: string): string {
  const safeVersion =
    (version ?? "")
      .replace(/[^0-9.]/g, "")
      .replace(/\.{2,}/g, ".")
      .replace(/^\.+|\.+$/g, "") || "unknown";
  const safeHash = sha256.replace(/[^a-f0-9]/gi, "").slice(0, 64);
  return `v${safeVersion}/${safeHash}.pdf`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
