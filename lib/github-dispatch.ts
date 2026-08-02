/**
 * Server-only GitHub `repository_dispatch` client.
 *
 * WHY THIS EXISTS
 *   There is no permanent worker any more. An upload creates a queued run and
 *   then has to *ask* GitHub Actions to process it. That request carries a
 *   credential, so it can only ever run on the server.
 *
 * THE THREAT MODEL, AND WHAT IS DONE ABOUT IT
 *   1. Token leaking to the browser. This module is never imported by a client
 *      component; the guard below turns a mistake into an immediate, obvious
 *      crash instead of a silently shipped secret. The variable is not
 *      NEXT_PUBLIC_*, so Next will not inline it into the bundle either.
 *   2. Becoming a workflow-execution oracle. The event type and repository are
 *      NOT caller-controlled. A request cannot name a different workflow, a
 *      different repo, or a different ref. The only caller-supplied value is a
 *      run id, and it must parse as a UUID.
 *   3. Leaking the token through error text. GitHub error bodies can echo
 *      request metadata. Nothing from the response is ever returned or stored —
 *      callers get a fixed machine code from a closed set.
 *
 * FAILURE IS NOT FATAL. If dispatch fails the PDF is already uploaded and the
 * run is already 'queued'. The scheduled recovery workflow will collect it.
 * Callers must surface a warning, never fail the upload.
 */

if (typeof window !== "undefined") {
  throw new Error(
    "lib/github-dispatch must never be imported into client code — it handles a credential."
  );
}

/** Hardcoded. The workflow listens for exactly this type. */
const DISPATCH_EVENT_TYPE = "pdf_sync_queued";

/** owner/repo, GitHub's own naming rules. Rejects paths, query strings, hosts. */
const REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,38})\/[A-Za-z0-9._-]{1,100}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DISPATCH_TIMEOUT_MS = 8000;

export type DispatchErrorCode =
  | "DISPATCH_NOT_CONFIGURED"
  | "DISPATCH_BAD_REPOSITORY"
  | "DISPATCH_BAD_RUN_ID"
  | "DISPATCH_UNAUTHORIZED"
  | "DISPATCH_FORBIDDEN"
  | "DISPATCH_NOT_FOUND"
  | "DISPATCH_RATE_LIMITED"
  | "DISPATCH_TIMEOUT"
  | "DISPATCH_UNAVAILABLE"
  | "DISPATCH_FAILED";

export type DispatchResult =
  | { ok: true }
  | { ok: false; code: DispatchErrorCode };

/**
 * True when the deployment is capable of dispatching at all.
 * Surfaced to the admin UI as `dispatcherConfigured` so a missing secret is
 * visible on the health panel instead of being discovered by an upload that
 * never processes.
 */
export function isDispatchConfigured(): boolean {
  const repo = process.env.GITHUB_DISPATCH_REPOSITORY ?? "";
  const token = process.env.GITHUB_DISPATCH_TOKEN ?? "";
  return REPO_RE.test(repo) && token.length > 0;
}

/** Map an HTTP status to a closed-set code. Never returns response text. */
function codeForStatus(status: number): DispatchErrorCode {
  if (status === 401) return "DISPATCH_UNAUTHORIZED";
  if (status === 403) return "DISPATCH_FORBIDDEN";
  if (status === 404) return "DISPATCH_NOT_FOUND"; // also: token lacks repo visibility
  if (status === 429) return "DISPATCH_RATE_LIMITED";
  if (status >= 500) return "DISPATCH_UNAVAILABLE";
  return "DISPATCH_FAILED";
}

/**
 * Ask GitHub Actions to process the queue.
 *
 * Resolves to a result object; it does not throw. A dispatch failure is an
 * expected, recoverable condition, not an exception.
 */
export async function dispatchPdfSync(runId: string): Promise<DispatchResult> {
  const repo = process.env.GITHUB_DISPATCH_REPOSITORY ?? "";
  const token = process.env.GITHUB_DISPATCH_TOKEN ?? "";

  if (!token) return { ok: false, code: "DISPATCH_NOT_CONFIGURED" };
  if (!REPO_RE.test(repo)) return { ok: false, code: "DISPATCH_BAD_REPOSITORY" };
  if (!UUID_RE.test(runId)) return { ok: false, code: "DISPATCH_BAD_RUN_ID" };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.github.com/repos/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "goto-pdf-update-studio",
      },
      // event_type is a constant. client_payload carries the run id only, so a
      // caller cannot smuggle inputs into the workflow.
      body: JSON.stringify({
        event_type: DISPATCH_EVENT_TYPE,
        client_payload: { runId },
      }),
      signal: controller.signal,
      cache: "no-store",
    });

    // 204 No Content is success for this endpoint.
    if (response.status === 204) return { ok: true };
    return { ok: false, code: codeForStatus(response.status) };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return { ok: false, code: aborted ? "DISPATCH_TIMEOUT" : "DISPATCH_UNAVAILABLE" };
  } finally {
    clearTimeout(timer);
  }
}

/** Administrator-facing sentences. No status codes, no stack traces, no jargon. */
export function dispatchMessage(code: DispatchErrorCode): string {
  switch (code) {
    case "DISPATCH_NOT_CONFIGURED":
      return "Automatic processing is not configured yet. Your PDF is saved and will be picked up by the scheduled check.";
    case "DISPATCH_UNAUTHORIZED":
    case "DISPATCH_FORBIDDEN":
    case "DISPATCH_NOT_FOUND":
      return "Processing could not be started automatically because of a configuration problem. Your PDF is saved and the scheduled check will process it. Tell engineering.";
    case "DISPATCH_RATE_LIMITED":
      return "Processing could not be started immediately because the service is busy. Your PDF is saved and will be processed shortly.";
    case "DISPATCH_TIMEOUT":
    case "DISPATCH_UNAVAILABLE":
      return "Processing could not be started immediately. Your PDF is saved and the scheduled check will process it.";
    default:
      return "Processing could not be started immediately. Your PDF is saved and will be processed by the scheduled check.";
  }
}
