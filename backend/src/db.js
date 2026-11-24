import 'dotenv/config';
import pg from 'pg';
const { Pool } = pg;
if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('YOUR_')) {
  console.warn('DATABASE_URL has not yet been configured in backend/.env');
}
export const pool = new Pool({ connectionString: process.env.DATABASE_URL || undefined, max: 8,
  connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000 });
export const query = (text, values=[]) => pool.query(text, values);
export async function transaction(fn) {
 const c = await pool.connect();
 try { await c.query('BEGIN'); const value = await fn(c); await c.query('COMMIT'); return value; }
 catch(err) { await c.query('ROLLBACK'); throw err; }
 finally { c.release(); }
}
