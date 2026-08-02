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
 * Probe each required RPC. PostgREST answers PGRST202 ("Could not find the
 * function") when it is absent, which is exactly the signal we need — and the
 * probe is a normal authenticated call, requiring no special privilege.
 */
export async function checkMigrationReadiness(supabase) {
  const missing = [];

  for (const rpc of REQUIRED_RPCS) {
    // Deliberately called with no arguments: a wrong-arguments error still
    // proves the function EXISTS, which is all this check cares about.
    const { error } = await supabase.rpc(rpc, {});
    if (!error) continue;
    const notFound =
      error.code === "PGRST202" || /Could not find the function/i.test(error.message ?? "");
    if (notFound) missing.push(rpc);
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
