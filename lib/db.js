import pg from "pg";
let pool;
let ready;
export function database() {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error("DATABASE_NOT_CONFIGURED");
  if (!pool) {
    pool = new pg.Pool({
      connectionString,
      max: 4,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
    });
    // A disconnected idle client must not crash the application; requests report outages.
    pool.on("error", () => {});
  }
  return pool;
}
export async function initialize() {
  if (!ready)
    ready = migrate().catch((error) => {
      ready = undefined;
      throw error;
    });
  return ready;
}
async function migrate() {
  const client = await database().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtext('dharmique_schema_v1'))",
    );
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS dharmique;
      CREATE TABLE IF NOT EXISTS dharmique.visits (
        session_id uuid NOT NULL,
        day date NOT NULL DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date),
        PRIMARY KEY (session_id, day)
      );
      CREATE TABLE IF NOT EXISTS dharmique.bookings (
        id uuid PRIMARY KEY,
        service_id text NOT NULL,
        name text NOT NULL,
        phone text NOT NULL,
        gotra text NOT NULL DEFAULT '',
        prasadi boolean NOT NULL,
        seva_fee integer,
        prasadi_fee integer NOT NULL CHECK (prasadi_fee IN (0, 200)),
        status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'confirmed', 'cancelled')),
        payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        version integer NOT NULL DEFAULT 1
      );
      ALTER TABLE dharmique.bookings ADD COLUMN IF NOT EXISTS address text NOT NULL DEFAULT '';
      ALTER TABLE dharmique.bookings ADD COLUMN IF NOT EXISTS city text NOT NULL DEFAULT '';
      ALTER TABLE dharmique.bookings ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
      CREATE INDEX IF NOT EXISTS bookings_created ON dharmique.bookings (created_at DESC, id);
      CREATE TABLE IF NOT EXISTS dharmique.sessions (
        token_hash text PRIMARY KEY,
        credential_tag text NOT NULL,
        expires_at timestamptz NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dharmique.rate_limits (
        key text NOT NULL, window_start bigint NOT NULL, count integer NOT NULL,
        PRIMARY KEY (key, window_start)
      );
    `);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function closeDatabase() {
  if (pool) await pool.end();
  pool = undefined;
  ready = undefined;
}
