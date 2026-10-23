import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

export async function openDatabase({ url = process.env.DATABASE_URL, dataDir = process.env.LOCAL_DATA_DIR || '.data/postgres' } = {}) {
  if (url) {
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: url, max: 8, connectionTimeoutMillis: 15000, idleTimeoutMillis: 30000 });
    return { kind: 'postgres', query: (sql, args = []) => pool.query(sql, args), async transaction(fn) {
      const client = await pool.connect();
      try { await client.query('BEGIN'); const result = await fn(client); await client.query('COMMIT'); return result; }
      catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
    }, close: () => pool.end() };
  }
  if (process.env.NODE_ENV === 'production') throw new Error('生产环境必须设置 Neon DATABASE_URL，不能使用本地临时磁盘。');
  const { PGlite } = await import('@electric-sql/pglite');
  if (dataDir !== 'memory://') await mkdir(resolve(dataDir), { recursive: true });
  const pg = new PGlite(dataDir === 'memory://' ? undefined : resolve(dataDir));
  await pg.waitReady;
  return { kind: 'pglite', query: (sql, args = []) => pg.query(sql, args), transaction: fn => pg.transaction(fn), close: () => pg.close() };
}

export async function migrate(db) {
  await db.transaction(async tx => {
    // A transaction advisory lock serializes concurrent Render deploys against Neon.
    if (db.kind === 'postgres') await tx.query('SELECT pg_advisory_xact_lock(784362010)');
    const statements = [
      `CREATE TABLE IF NOT EXISTS app_meta (key text PRIMARY KEY, value jsonb NOT NULL)`,
      `CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text NOT NULL UNIQUE, name text NOT NULL, role text NOT NULL CHECK (role IN ('admin','operator','editor','viewer')), password_hash text NOT NULL, active boolean NOT NULL DEFAULT true, must_change_password boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, csrf text NOT NULL, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires_at)`,
      `CREATE TABLE IF NOT EXISTS content_items (id text PRIMARY KEY, module text NOT NULL, slug text NOT NULL, title text NOT NULL, draft jsonb NOT NULL, published jsonb, status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')), version integer NOT NULL DEFAULT 1, sort_order integer NOT NULL DEFAULT 0, updated_by text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), published_at timestamptz, UNIQUE(module,slug))`,
      `CREATE INDEX IF NOT EXISTS content_module_order ON content_items(module,sort_order)`,
      `CREATE TABLE IF NOT EXISTS content_history (id bigserial PRIMARY KEY, content_id text NOT NULL REFERENCES content_items(id) ON DELETE CASCADE, version integer NOT NULL, data jsonb NOT NULL, action text NOT NULL, actor_id text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS business_records (id text PRIMARY KEY, kind text NOT NULL CHECK (kind IN ('consultation','claim','tour')), visitor_hash text NOT NULL, data jsonb NOT NULL, status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','resolved')), reply text NOT NULL DEFAULT '', version integer NOT NULL DEFAULT 1, assigned_to text REFERENCES users(id) ON DELETE SET NULL, idempotency_key text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(visitor_hash,idempotency_key))`,
      `CREATE INDEX IF NOT EXISTS records_visitor_created ON business_records(visitor_hash,created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS records_kind_status ON business_records(kind,status)`,
      `CREATE TABLE IF NOT EXISTS record_notes (id bigserial PRIMARY KEY, record_id text NOT NULL REFERENCES business_records(id) ON DELETE CASCADE, actor_id text REFERENCES users(id) ON DELETE SET NULL, status text NOT NULL, reply text NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS media (id text PRIMARY KEY, name text NOT NULL, mime text NOT NULL, size integer NOT NULL, visibility text NOT NULL CHECK (visibility IN ('public','private')), bytes bytea NOT NULL, alt text NOT NULL DEFAULT '', source_ref text NOT NULL DEFAULT '', record_id text REFERENCES business_records(id) ON DELETE CASCADE, actor_id text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS media_record ON media(record_id)`,
      `CREATE TABLE IF NOT EXISTS drafts (id text PRIMARY KEY, title text NOT NULL, body text NOT NULL, source_refs jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','published')), revision integer NOT NULL DEFAULT 1, checks jsonb NOT NULL DEFAULT '[false,false,false,false,false,false,false]', owner_id text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS draft_history (id bigserial PRIMARY KEY, draft_id text NOT NULL REFERENCES drafts(id) ON DELETE CASCADE, revision integer NOT NULL, title text NOT NULL, body text NOT NULL, source_refs jsonb NOT NULL, actor_id text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE TABLE IF NOT EXISTS publications (id text PRIMARY KEY, draft_id text NOT NULL REFERENCES drafts(id) ON DELETE CASCADE, revision integer NOT NULL, title text NOT NULL, body text NOT NULL, source_refs jsonb NOT NULL, published_by text REFERENCES users(id) ON DELETE SET NULL, active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(draft_id,revision))`,
      `CREATE TABLE IF NOT EXISTS analytics_events (id text PRIMARY KEY, visitor_hash text NOT NULL, session_id text NOT NULL, event text NOT NULL CHECK (event IN ('pageview','engagement','click','conversion')), route text NOT NULL, target text NOT NULL DEFAULT '', referrer text NOT NULL DEFAULT '', device text NOT NULL DEFAULT '', browser text NOT NULL DEFAULT '', os text NOT NULL DEFAULT '', country text NOT NULL DEFAULT '', duration integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS events_created ON analytics_events(created_at)`,
      `CREATE INDEX IF NOT EXISTS events_route_created ON analytics_events(route,created_at)`,
      `CREATE TABLE IF NOT EXISTS request_logs (id text PRIMARY KEY, method text NOT NULL, path text NOT NULL, status integer NOT NULL, duration integer NOT NULL, created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS requests_created ON request_logs(created_at)`,
      `CREATE TABLE IF NOT EXISTS audit_logs (id bigserial PRIMARY KEY, actor_id text REFERENCES users(id) ON DELETE SET NULL, actor_name text NOT NULL DEFAULT '', action text NOT NULL, entity text NOT NULL DEFAULT '', detail jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS audit_created ON audit_logs(created_at)`,
      `CREATE TABLE IF NOT EXISTS workflow_items (id text PRIMARY KEY, kind text NOT NULL, title text NOT NULL, data jsonb NOT NULL, version integer NOT NULL DEFAULT 1, created_by text REFERENCES users(id) ON DELETE SET NULL, updated_by text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now())`,
      `CREATE INDEX IF NOT EXISTS workflow_kind_created ON workflow_items(kind,created_at DESC)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS workflow_external_order ON workflow_items ((data->>'channel'),(data->>'externalOrderNo')) WHERE kind='orders' AND coalesce(data->>'externalOrderNo','')!=''`,
      `CREATE UNIQUE INDEX IF NOT EXISTS workflow_customer_source ON workflow_items ((data->>'sourceRecordId')) WHERE kind='customers' AND coalesce(data->>'sourceRecordId','')!=''`,
      `CREATE UNIQUE INDEX IF NOT EXISTS workflow_open_rule ON workflow_items ((data->>'ruleKey')) WHERE kind='decisions' AND data->>'status' IN ('proposed','adopted','executed') AND coalesce(data->>'ruleKey','')!=''`,
      `CREATE TABLE IF NOT EXISTS workflow_history (id bigserial PRIMARY KEY, item_id text NOT NULL REFERENCES workflow_items(id) ON DELETE CASCADE, version integer NOT NULL, data jsonb NOT NULL, actor_id text REFERENCES users(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now())`
    ];
    for (const statement of statements) await tx.query(statement);
    await tx.query(`INSERT INTO app_meta(key,value) VALUES ('schema_version','2') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`);
  });
}

export const one = async (db, sql, args = []) => (await db.query(sql, args)).rows[0];
