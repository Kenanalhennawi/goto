import { NextResponse } from "next/server";
import { requireReviewer } from "@/lib/auth/guards";
import { isDispatchConfigured } from "@/lib/github-dispatch";

/**
 * Processing-system health for the admin UI.
 *
 * WHY THIS NO LONGER SAYS "WORKER ONLINE"
 *   It used to report `workerOnline`, derived from a heartbeat written by a
 *   permanent Render service. That service is gone — Render charges for
 *   background workers and the free tier cannot host one — and processing now
 *   runs as finite GitHub Actions jobs. Between uploads there is legitimately
 *   no process at all.
 *
 *   Keeping the old field would have been actively harmful: it would read
 *   "offline" during completely normal idle operation, so the one signal that
 *   should mean "something is wrong" would mean nothing, and a real outage
 *   would be indistinguishable from a quiet afternoon. The question worth
 *   answering is not "is a process alive" but "will my upload get processed,
 *   and is anything stuck".
 *
 * THE CONTRACT
 *   - dispatcherConfigured: can this deployment start processing at all?
 *   - lastDispatchSuccessAt: when did that last actually work?
 *   - queueDepth / oldestQueuedAt / stuckQueuedCount: is anything waiting, and
 *     for how long?
 *   - recoveryScheduleConfigured: is there a safety net behind the dispatcher?
 *   A queued run must never sit silently, so `stuckQueuedCount` drives an
 *   explicit, reassuring message rather than silence.
 */
export const dynamic = "force-dynamic";

// The scheduled recovery workflow is committed at
// .github/workflows/recover-pdf-sync.yml. It is part of the deployed artifact,
// so its presence is a property of this build, not runtime configuration.
const RECOVERY_SCHEDULE_CONFIGURED = true;

export async function GET() {
  const session = await requireReviewer();
  if (!session.ok) return session.response;
  const { supabase } = session;

  const dispatcherConfigured = isDispatchConfigured();
  const { data, error } = await supabase.rpc("sync_system_health");

  if (error) {
    // A missing function means the migrations have not been applied to this
    // database yet. Name that precisely — it is the most common deployment gap.
    const missing =
      error.code === "PGRST202" || /Could not find the function/i.test(error.message ?? "");
    return NextResponse.json(
      {
        migrationReady: false,
        processingSystemReady: false,
        dispatcherConfigured,
        recoveryScheduleConfigured: RECOVERY_SCHEDULE_CONFIGURED,
        degraded: true,
        reason: missing ? "MIGRATION_PENDING" : "HEALTH_UNAVAILABLE",
        message: missing
          ? "The database is still being updated. Wait a minute and reload."
          : "Processing status is temporarily unavailable.",
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const health = (data ?? {}) as Record<string, unknown>;
  const queueDepth = Number(health.queueDepth ?? 0);
  const stuckQueued = Number(health.stuckQueuedCount ?? 0);
  const activeRun = health.activeRun ?? null;

  // "Ready" means an upload will get processed: the database understands the
  // schema AND something is able to start a job.
  const processingSystemReady = dispatcherConfigured && health.migrationReady === true;

  // Ordered most-specific first. Each branch is a sentence an administrator can
  // act on; none of them mention a process, a heartbeat, or a status code.
  let message: string;
  if (!dispatcherConfigured) {
    message = RECOVERY_SCHEDULE_CONFIGURED
      ? "Automatic processing is not configured, so uploads are picked up by the scheduled check instead. Tell engineering."
      : "Automatic processing is not configured. Tell engineering before uploading.";
  } else if (activeRun) {
    message = "Processing in progress.";
  } else if (stuckQueued > 0) {
    message =
      `${stuckQueued} upload(s) have been waiting longer than expected. ` +
      "They are safe and the scheduled check will process them. Tell engineering if this persists.";
  } else if (queueDepth > 0) {
    message = `Processing requested. ${queueDepth} upload(s) waiting to start.`;
  } else {
    message = "Processing system ready.";
  }

  return NextResponse.json(
    {
      ...health,
      dispatcherConfigured,
      recoveryScheduleConfigured: RECOVERY_SCHEDULE_CONFIGURED,
      processingSystemReady,
      // Degraded means "needs a human", not "idle". An empty queue with no
      // dispatcher is still degraded; a busy queue with a working dispatcher
      // is not.
      degraded: !processingSystemReady || stuckQueued > 0,
      message,
    },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
