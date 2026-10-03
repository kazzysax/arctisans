import { createClient, type Client } from "@libsql/client";

let _db: Client | null = null;
export function db(): Client {
  if (!_db) {
    _db = createClient({
      url: process.env.DATABASE_URL ?? "file:./local.db",
      authToken: process.env.DATABASE_AUTH_TOKEN,
    });
  }
  return _db;
}
export function setDb(c: Client) {
  _db = c;
}

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, wallet TEXT NOT NULL UNIQUE, handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL, kind TEXT NOT NULL DEFAULT 'human', owner_wallet TEXT,
  title TEXT, bio TEXT, scope TEXT, skills TEXT NOT NULL DEFAULT '[]', links TEXT NOT NULL DEFAULT '[]',
  city TEXT, avatar TEXT, verified INTEGER NOT NULL DEFAULT 0, agent_id TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, author_wallet TEXT NOT NULL, feed TEXT NOT NULL, body TEXT,
  images TEXT NOT NULL DEFAULT '[]', skill TEXT, city TEXT, hash TEXT, budget INTEGER, hidden INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS posts_feed ON posts(feed, created_at DESC);
CREATE TABLE IF NOT EXISTS follows (follower TEXT NOT NULL, followee TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(follower, followee));
CREATE TABLE IF NOT EXISTS likes (post_id TEXT NOT NULL, wallet TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(post_id, wallet));
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, chain_job_id INTEGER, client TEXT NOT NULL, artisan TEXT NOT NULL,
  terms TEXT NOT NULL, terms_hash TEXT NOT NULL UNIQUE, skills TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'Draft', created_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS jobs_chain ON jobs(chain_job_id) WHERE chain_job_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS chain_events (
  id TEXT PRIMARY KEY, block INTEGER NOT NULL, tx TEXT NOT NULL, contract TEXT NOT NULL,
  name TEXT NOT NULL, args TEXT NOT NULL, ts INTEGER
);
CREATE INDEX IF NOT EXISTS ce_name ON chain_events(name);
CREATE TABLE IF NOT EXISTS tips (
  id TEXT PRIMARY KEY, from_wallet TEXT NOT NULL, to_wallet TEXT NOT NULL, post_hash TEXT, amount INTEGER NOT NULL, ts INTEGER
);
CREATE INDEX IF NOT EXISTS tips_to ON tips(to_wallet);
CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY, job_chain_id INTEGER NOT NULL, reviewer TEXT NOT NULL, subject TEXT NOT NULL,
  rating INTEGER NOT NULL, body TEXT, review_hash TEXT NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(job_chain_id, reviewer)
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY, wallet TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL,
  read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS notif_wallet ON notifications(wallet, created_at DESC);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY, agent_wallet TEXT NOT NULL, owner_wallet TEXT NOT NULL, label TEXT,
  key_hash TEXT NOT NULL UNIQUE, secret_enc TEXT NOT NULL, scopes TEXT NOT NULL,
  per_job_cap INTEGER NOT NULL, daily_cap INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS agent_spend (id TEXT PRIMARY KEY, key_id TEXT NOT NULL, amount INTEGER NOT NULL, ref TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS spend_key ON agent_spend(key_id, created_at);
CREATE TABLE IF NOT EXISTS idempotency (key_id TEXT NOT NULL, idem TEXT NOT NULL, response TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(key_id, idem));
CREATE TABLE IF NOT EXISTS used_nonces (key_id TEXT NOT NULL, nonce TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY(key_id, nonce));
CREATE TABLE IF NOT EXISTS chain_state (k TEXT PRIMARY KEY, v TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS job_messages (id TEXT PRIMARY KEY, job_id TEXT NOT NULL, sender TEXT NOT NULL, body TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS job_msgs ON job_messages(job_id, created_at);
CREATE TABLE IF NOT EXISTS rate_limits (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset_at INTEGER NOT NULL);
`;

let migrated = false;
export async function migrate(c: Client = db()) {
  if (migrated && c === _db) return;
  await c.executeMultiple(SCHEMA);
  // additive columns (older databases): ignore 'duplicate column' errors
  for (const sql of ["ALTER TABLE users ADD COLUMN cv TEXT NOT NULL DEFAULT '{}'", "ALTER TABLE users ADD COLUMN cover TEXT", "ALTER TABLE posts ADD COLUMN video TEXT"]) {
    try { await c.execute(sql); } catch { /* already there */ }
  }
  if (c === _db) migrated = true;
}
