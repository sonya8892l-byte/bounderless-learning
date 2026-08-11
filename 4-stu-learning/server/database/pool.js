import pg from 'pg';

const { Pool } = pg;

function safePoolError(logger, error) {
  const details = {
    code: error?.code || 'DATABASE_POOL_ERROR',
    name: error?.name || 'Error',
  };
  if (typeof logger?.error === 'function') {
    logger.error({ err: details }, 'database idle client error');
  }
}

export function createDatabasePool({
  databaseUrl,
  max = 2,
  connectionTimeoutMillis = 5_000,
  queryTimeoutMillis = 8_000,
  idleTimeoutMillis = 10_000,
  maxLifetimeSeconds = 300,
  logger,
  PoolClass = Pool,
} = {}) {
  if (!databaseUrl) throw new Error('createDatabasePool 需要 databaseUrl。');
  const pool = new PoolClass({
    connectionString: databaseUrl,
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    maxLifetimeSeconds,
    query_timeout: queryTimeoutMillis,
    statement_timeout: queryTimeoutMillis,
    idle_in_transaction_session_timeout: queryTimeoutMillis,
    application_name: 'forbidden-city-study-api',
  });
  pool.on('error', (error) => safePoolError(logger, error));
  return pool;
}

export async function probeDatabase(pool) {
  const startedAt = performance.now();
  const tableResult = await pool.query(`
    select
      to_regclass('public.learner_sessions') is not null as learner_sessions_exists,
      to_regclass('public.learner_requests') is not null as learner_requests_exists,
      to_regclass('public.course_runs') is not null as course_runs_exists,
      to_regclass('public.runtime_state') is not null as runtime_state_exists
  `);
  const tables = tableResult.rows[0] || {};
  const requiredTablesExist = Boolean(
    tables.learner_sessions_exists
    && tables.learner_requests_exists
    && tables.course_runs_exists
    && tables.runtime_state_exists
  );
  let schemaReady = false;

  if (requiredTablesExist) {
    const schemaResult = await pool.query(`
      select
      exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'learner_sessions'
          and column_name = 'state_version'
      ) as session_schema_ready,
      (
        select count(*) = 5
        from information_schema.columns
        where table_schema = 'public'
          and table_name = 'learner_requests'
          and column_name in (
            'request_digest',
            'status',
            'lease_token',
            'lease_expires_at',
            'result'
          )
      ) as request_schema_ready,
      exists (
        select 1
        from pg_class index_class
        join pg_index index_state on index_state.indexrelid = index_class.oid
        where index_class.oid = to_regclass(
          'public.learner_requests_one_processing_per_session_uidx'
        )
          and index_state.indisunique
          and index_state.indisvalid
      ) as request_lease_index_ready,
      exists (
        select 1
        from public.runtime_state
        where id = 'course-runs'
      ) as runtime_state_seed_ready
    `);
    const schema = schemaResult.rows[0] || {};
    schemaReady = Boolean(
      schema.session_schema_ready
      && schema.request_schema_ready
      && schema.request_lease_index_ready
      && schema.runtime_state_seed_ready
    );
  }

  return {
    healthy: schemaReady,
    schemaReady,
    latencyMs: Math.max(0, Math.round(performance.now() - startedAt)),
  };
}
