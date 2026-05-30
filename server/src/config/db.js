import pg from 'pg';
import { env, isProd } from './env.js';

const { Pool } = pg;

// Neon and most managed Postgres require SSL; local Docker does not.
const needsSsl = /neon\.tech|render\.com|supabase|amazonaws/.test(env.DATABASE_URL) || isProd;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: needsSsl ? { rejectUnauthorized: false } : false,
  max: 10,
});

pool.on('error', (err) => {
  console.error('Unexpected PG pool error:', err);
});

/** Run a single parameterized query. */
export const query = (text, params) => pool.query(text, params);

/** Get a dedicated client for transactions (remember to release()). */
export const getClient = () => pool.connect();

/** Helper: run a function inside a transaction. */
export async function withTransaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
