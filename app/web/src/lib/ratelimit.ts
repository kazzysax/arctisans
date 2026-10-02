import { db, migrate } from "@/db";

/** Fixed-window limiter stored in the DB (works on serverless). Returns true if allowed. */
export async function allow(key: string, limit: number, windowMs: number): Promise<boolean> {
  await migrate();
  const now = Date.now();
  const r = await db().execute({ sql: "SELECT n, reset_at FROM rate_limits WHERE k=?", args: [key] });
  if (!r.rows[0] || Number(r.rows[0].reset_at) <= now) {
    await db().execute({ sql: "INSERT INTO rate_limits(k,n,reset_at) VALUES(?,1,?) ON CONFLICT(k) DO UPDATE SET n=1, reset_at=excluded.reset_at", args: [key, now + windowMs] });
    return true;
  }
  if (Number(r.rows[0].n) >= limit) return false;
  await db().execute({ sql: "UPDATE rate_limits SET n=n+1 WHERE k=?", args: [key] });
  return true;
}
