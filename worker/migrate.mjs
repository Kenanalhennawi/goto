// ============================================================
// Migration READINESS CHECK — not a migration runner.
//
// WHY THIS IS NO LONGER A RUNNER
//   The earlier version of this file applied migrations itself through a
//   generic exec_sql(text) SECURITY DEFINER function. That was the wrong
//   design and it has been removed:
//     * a permanent arbitrary-SQL RPC is a standing remote-code-execution
//       primitive, one grant mistake away from being callable by the browser;
//     * it needed a one-time manual SQL bootstrap, exactly the kind of step
//       this project exists to eliminate;
//     * two worker instances could race each other applying migrations.
//
//   Migrations now run in CI (.github/workflows/deploy.yml) via the Supabase
//   CLI over an authenticated Postgres connection, before the worker deploys.
//   The CLI takes an advisory lock and records applied files in
//   supabase_migrations.schema_migrations, so concurrency and history are
//   handled by the tool that owns them.
//
//   The worker's remaining job is to REFUSE TO RUN against a schema it does not
//   understand, so a half-deployed system fails loudly instead of corrupting
//   data. No arbitrary SQL, no elevated DDL, no bootstrap.
// ============================================================

/**
 * Objects this build of the worker depends on. If any are missing, the database
 * has not been migrated to the expected shape and the worker must not process
 * jobs.
 */
const REQUIRED_RPCS = [
  "claim_sync_run",
  "requeue_sync_run",
  "record_worker_heartbeat",
  "sync_system_health",
];

/**
 * Ask the database directly.
 *
 * THE BUG THIS REPLACES. The previous check called each required RPC with NO
 * arguments and treated PGRST202 as proof of absence, on the stated assumption
 * that "a wrong-arguments error still proves the function EXISTS". That
 * assumption is false. PostgREST resolves a function by name AND argument list,
 * so a function with REQUIRED parameters can never be matched by a no-argument
 * call — it answers PGRST202, identically to a function that does not exist.
 *
 * The result: claim_sync_run(text, integer), requeue_sync_run(uuid, text) and
 * record_worker_heartbeat(text, uuid, text) ALWAYS reported as missing, and the
 * worker refused to start against a perfectly correct database. Only
 * sync_system_health(), which happens to take no arguments, ever passed. This
 * was observed on a live staging run before it was diagnosed.
 *
 * Probing by execution is the wrong instrument anyway: calling claim_sync_run
 * to find out whether it exists would actually claim a job.
 *
 * sync_schema_ready() asks pg_proc instead — no side effects, no argument
 * guessing — and additionally reports overload counts, so a resurrected
 * superseded signature is caught here rather than at publish time.
 */
export async function checkMigrationReadiness(supabase) {
  const probe = await supabase.rpc("sync_schema_ready", {});
  if (!probe.error) {
    const r = probe.data ?? {};
    const missing = Array.isArray(r.missing) ? [...r.missing] : [];
    if (r.settingsTable === false) missing.push("sync_settings");
    // Exactly one signature of each must survive the consolidation migration.
    if (Number(r.publishOverloads) > 1) missing.push("publish_sync_run:DUPLICATE_OVERLOAD");
    if (Number(r.claimOverloads) > 1) missing.push("claim_sync_run:DUPLICATE_OVERLOAD");
    return {
      ready: r.ready === true && missing.length === 0,
      missing,
      message:
        r.ready === true && missing.length === 0
          ? "Database schema matches this worker build."
          : `Database is not migrated for this build. Missing: ${missing.join(", ")}. ` +
            "Apply supabase/migrations before starting the worker.",
    };
  }

  // Fallback for a database that predates sync_schema_ready(). Argument-aware:
  // PostgREST supplies a `hint` naming the real signature when the function
  // exists but the argument list did not match, which distinguishes
  // "wrong arguments" from "genuinely absent".
  const missing = [];
  for (const rpc of REQUIRED_RPCS) {
    const { error } = await supabase.rpc(rpc, {});
    if (!error) continue;
    const notFound =
      error.code === "PGRST202" || /Could not find the function/i.test(error.message ?? "");
    const hintNamesIt = new RegExp(`\\b${rpc}\\b`).test(error.hint ?? "");
    if (notFound && !hintNamesIt) missing.push(rpc);
  }

  // sync_settings backs the single-source threshold; its absence means the
  // consolidation migration has not been applied.
  const { error: settingsError } = await supabase
    .from("sync_settings")
    .select("key")
    .limit(1);
  if (settingsError && /does not exist/i.test(settingsError.message ?? "")) {
    missing.push("sync_settings");
  }

  return {
    ready: missing.length === 0,
    missing,
    message:
      missing.length === 0
        ? "Database schema matches this worker build."
        : `Database is not migrated for this build. Missing: ${missing.join(", ")}. ` +
          "The deploy pipeline applies migrations before the worker starts; " +
          "re-run the Deploy workflow.",
  };
}
