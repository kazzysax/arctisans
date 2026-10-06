// X (Twitter) linkage: "@arctisans post this" imports YOUR OWN post from X to your Arctisans profile.
// Rules (pickImport): only the linked X account; no retweets; replies only under your own posts; needs text, pictures or video.
// Reliability rules (each one fixes a failure we actually hit):
//  - one poll at a time (lock), so runs never race each other
//  - the bot's X login renews single-flight (X renewal keys work once)
//  - every failure is recorded with its reason, retried up to 3 times, and the user gets a reply saying why
//  - long videos are trimmed to fit 20 MB (sound kept) instead of failing
//  - reply text is unique per post (X rejects a reply identical to an earlier one)
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { keccak256, toBytes } from "viem";
import { put } from "@vercel/blob";
import { db, migrate } from "@/db";
import { env } from "./env";
import { processImage, storeImage } from "./images";
import { fitVideo } from "./xvideo";

const API = "https://api.x.com/2";
const APP = () => process.env.APP_URL ?? "https://arctisans.vercel.app";
export const X_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS x_links (wallet TEXT PRIMARY KEY, x_id TEXT NOT NULL UNIQUE, x_username TEXT NOT NULL, linked_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS x_imports (tweet_id TEXT PRIMARY KEY, wallet TEXT, post_id TEXT, status TEXT NOT NULL, reason TEXT, created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS x_oauth (state TEXT PRIMARY KEY, verifier TEXT NOT NULL, wallet TEXT NOT NULL, purpose TEXT NOT NULL, created_at INTEGER NOT NULL)",
];
let migrated = false;
export async function xMigrate() {
  if (migrated) return;
  await migrate(); for (const s of X_SCHEMA) await db().execute(s);
  // replied: 0 = imported but the confirmation on X has not gone out yet. attempts: failed imports are retried up to 3 times.
  for (const sql of ["ALTER TABLE x_imports ADD COLUMN replied INTEGER NOT NULL DEFAULT 1", "ALTER TABLE x_imports ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0"]) {
    try { await db().execute(sql); } catch { /* column exists */ }
  }
  migrated = true;
}

export const xConfigured = () => !!(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
export const botHandle = () => (process.env.X_BOT_HANDLE ?? "arctisans").replace(/^@/, "").toLowerCase();
const redirectUri = () => `${APP()}/api/x/callback`;

// ---- small encrypted store for the bot's own tokens (kept in chain_state) ----
const key = () => createHash("sha256").update(`arctisans-x:${env.appSecret()}`).digest();
const enc = (s: string) => { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv); const ct = Buffer.concat([c.update(s, "utf8"), c.final()]); return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join("."); };
const dec = (s: string) => { const [iv, t, ct] = s.split(".").map((x) => Buffer.from(x, "base64")); const d = createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(t); return Buffer.concat([d.update(ct), d.final()]).toString("utf8"); };
async function getState(k: string) { const r = await db().execute({ sql: "SELECT v FROM chain_state WHERE k=?", args: [k] }); return r.rows[0] ? String(r.rows[0].v) : null; }
async function setState(k: string, v: string) { await db().execute({ sql: "INSERT INTO chain_state(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", args: [k, v] }); }
/** Claim a named lock for up to ttlMs. Returns false if someone else holds it. */
async function claim(name: string, ttlMs: number) {
  await db().execute({ sql: "INSERT OR IGNORE INTO chain_state(k,v) VALUES(?, '0')", args: [name] });
  const now = Date.now();
  const r = await db().execute({ sql: "UPDATE chain_state SET v=? WHERE k=? AND CAST(v AS INTEGER) < ?", args: [String(now), name, now - ttlMs] });
  return r.rowsAffected > 0;
}
const release = (name: string) => setState(name, "0");
const stamp = (note: string) => `${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · ${note}`;

// ---- OAuth 2.0 with PKCE ----
const b64u = (b: Buffer) => b.toString("base64url");
export async function startOAuth(wallet: string, purpose: "link" | "bot") {
  await xMigrate();
  const state = b64u(randomBytes(18)), verifier = b64u(randomBytes(40));
  await db().execute({ sql: "DELETE FROM x_oauth WHERE created_at < ?", args: [Date.now() - 15 * 60_000] });
  await db().execute({ sql: "INSERT INTO x_oauth(state,verifier,wallet,purpose,created_at) VALUES(?,?,?,?,?)", args: [state, verifier, wallet, purpose, Date.now()] });
  const scope = purpose === "bot" ? "tweet.read tweet.write users.read offline.access" : "tweet.read users.read";
  const u = new URL("https://x.com/i/oauth2/authorize");
  u.search = new URLSearchParams({ response_type: "code", client_id: process.env.X_CLIENT_ID!, redirect_uri: redirectUri(), scope, state,
    code_challenge: b64u(createHash("sha256").update(verifier).digest()), code_challenge_method: "S256" }).toString();
  return u.toString();
}
async function token(body: Record<string, string>) {
  const basic = Buffer.from(`${process.env.X_CLIENT_ID}:${process.env.X_CLIENT_SECRET}`).toString("base64");
  const r = await fetch(`${API}/oauth2/token`, { method: "POST", headers: { authorization: `Basic ${basic}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  if (!r.ok) throw new Error(`X login renewal failed (${r.status}): ${(await r.text()).slice(0, 120)}`);
  return (await r.json()) as { access_token: string; refresh_token?: string; expires_in: number };
}
export async function finishOAuth(state: string, code: string) {
  await xMigrate();
  const row = (await db().execute({ sql: "DELETE FROM x_oauth WHERE state=? AND created_at > ? RETURNING verifier, wallet, purpose", args: [state, Date.now() - 15 * 60_000] })).rows[0];
  if (!row) throw new Error("Link expired, try again");
  const t = await token({ grant_type: "authorization_code", code, redirect_uri: redirectUri(), code_verifier: String(row.verifier), client_id: process.env.X_CLIENT_ID! });
  const me = await fetch(`${API}/users/me`, { headers: { authorization: `Bearer ${t.access_token}` } });
  if (!me.ok) throw new Error(`X profile ${me.status}`);
  const u = ((await me.json()) as { data: { id: string; username: string } }).data;
  const wallet = String(row.wallet);
  if (row.purpose === "bot") {
    if (u.username.toLowerCase() !== botHandle()) throw new Error(`Sign in as @${botHandle()}, not @${u.username}`);
    await setState("x_bot", enc(JSON.stringify({ id: u.id, access: t.access_token, refresh: t.refresh_token, exp: Date.now() + t.expires_in * 1000 })));
    await setState("x_bot_health", stamp("connected"));
    return { purpose: "bot" as const, username: u.username };
  }
  const taken = (await db().execute({ sql: "SELECT wallet FROM x_links WHERE x_id=?", args: [u.id] })).rows[0];
  if (taken && String(taken.wallet) !== wallet) throw new Error(`@${u.username} is already linked to another Arctisans profile`);
  await db().execute({ sql: "INSERT INTO x_links(wallet,x_id,x_username,linked_at) VALUES(?,?,?,?) ON CONFLICT(wallet) DO UPDATE SET x_id=excluded.x_id, x_username=excluded.x_username, linked_at=excluded.linked_at", args: [wallet, u.id, u.username, Date.now()] });
  return { purpose: "link" as const, username: u.username };
}
export async function linkOf(wallet: string) {
  await xMigrate();
  const r = (await db().execute({ sql: "SELECT x_username, linked_at FROM x_links WHERE wallet=?", args: [wallet] })).rows[0];
  return r ? { username: String(r.x_username), linkedAt: Number(r.linked_at) } : null;
}
export async function unlink(wallet: string) { await xMigrate(); await db().execute({ sql: "DELETE FROM x_links WHERE wallet=?", args: [wallet] }); }

type Bot = { id: string; access: string; refresh?: string; exp: number };
const readBot = async () => { const raw = await getState("x_bot"); return raw ? (JSON.parse(dec(raw)) as Bot) : null; };
/** The bot's user token. Renewed single-flight: X renewal keys work once, so two renewals at the same moment break the login. */
async function botToken(): Promise<Bot | null> {
  const b = await readBot();
  if (!b) return null;
  if (b.exp - Date.now() > 120_000) return b;
  if (!b.refresh) return null;
  if (!(await claim("x_bot_lock", 30_000))) {
    for (let i = 0; i < 8; i++) { await new Promise((r) => setTimeout(r, 1500)); const a = await readBot(); if (a && a.exp - Date.now() > 120_000) return a; }
    return null;
  }
  try {
    const cur = (await readBot())!; // re-read inside the lock: another process may have just renewed
    if (cur.exp - Date.now() > 120_000) return cur;
    const t = await token({ grant_type: "refresh_token", refresh_token: cur.refresh ?? b.refresh, client_id: process.env.X_CLIENT_ID! });
    const nb = { id: cur.id, access: t.access_token, refresh: t.refresh_token ?? cur.refresh, exp: Date.now() + t.expires_in * 1000 };
    await setState("x_bot", enc(JSON.stringify(nb)));
    await setState("x_bot_health", stamp("login renewed"));
    return nb;
  } catch (e) {
    await setState("x_bot_health", stamp(`RECONNECT NEEDED: ${(e as Error).message}`));
    throw e;
  } finally { await release("x_bot_lock"); }
}
export async function botStatus() {
  await xMigrate();
  return {
    connected: !!(await getState("x_bot")), handle: botHandle(),
    health: (await getState("x_bot_health")) ?? "", lastReply: (await getState("x_reply_last")) ?? "no reply attempted yet",
    lastPoll: (await getState("x_poll_last")) ?? "not run yet",
  };
}

// ---- the rules ----
export type XTweet = {
  id: string; text: string; author_id: string; conversation_id?: string; in_reply_to_user_id?: string;
  referenced_tweets?: { type: "retweeted" | "quoted" | "replied_to"; id: string }[]; attachments?: { media_keys?: string[] };
};
export type XMedia = { media_key: string; type: "photo" | "video" | "animated_gif"; url?: string; preview_image_url?: string; duration_ms?: number; variants?: { bit_rate?: number; content_type: string; url: string }[] };
export const TRIGGER = (handle: string) => new RegExp(`@${handle}\\b[^\\n]*\\bpost\\s+(this|it)\\b`, "i");

/**
 * Decide what (if anything) to import for one mention. Pure function: all lookups are passed in.
 * The source is the mention itself, or (when the mention has no media and replies to your own post) the post it replies to.
 */
export function pickImport(m: XTweet, parent: XTweet | null, opts: { linkedXId: string | null; handle: string }): { ok: true; source: XTweet } | { ok: false; reason: string } {
  if (!TRIGGER(opts.handle).test(m.text)) return { ok: false, reason: "no 'post this' command" };
  if (!opts.linkedXId) return { ok: false, reason: "this X account is not linked to Arctisans yet (Settings, X)" };
  if (m.author_id !== opts.linkedXId) return { ok: false, reason: "only the linked account can import" };
  const refs = m.referenced_tweets ?? [];
  if (refs.some((r) => r.type === "retweeted")) return { ok: false, reason: "retweets are not original posts" };
  const replyTo = refs.find((r) => r.type === "replied_to");
  let source = m;
  if (!m.attachments?.media_keys?.length && replyTo) {
    if (!parent || parent.id !== replyTo.id) return { ok: false, reason: "could not read the post you replied to" };
    if (parent.author_id !== m.author_id) return { ok: false, reason: "you can only import your own posts" };
    source = parent;
  } else if (replyTo && m.in_reply_to_user_id && m.in_reply_to_user_id !== m.author_id) {
    return { ok: false, reason: "replies to someone else are not original posts" };
  }
  const srcRefs = source.referenced_tweets ?? [];
  if (srcRefs.some((r) => r.type === "retweeted")) return { ok: false, reason: "that post is a retweet" };
  if (source !== m && source.in_reply_to_user_id && source.in_reply_to_user_id !== source.author_id) return { ok: false, reason: "that post is a reply to someone else" };
  if (!source.attachments?.media_keys?.length && !cleanCaption(source.text, opts.handle)) return { ok: false, reason: "the post has no text, pictures or video" };
  return { ok: true, source };
}
/** Caption = the post text without the command, links and mentions of us. */
export function cleanCaption(text: string, handle: string) {
  return text.replace(TRIGGER(handle), "").replace(new RegExp(`@${handle}\\b`, "gi"), "").replace(/https:\/\/t\.co\/\S+/g, "").replace(/[ \t]+/g, " ").trim().slice(0, 1500);
}

// ---- X API calls ----
async function bearer(path: string) {
  const r = await fetch(`${API}${path}`, { headers: { authorization: `Bearer ${process.env.X_BEARER_TOKEN}` } });
  if (r.status === 402) throw new Error("X API credits are used up (top up in console.x.com)");
  if (r.status === 429) throw new Error("X rate limit hit, will retry");
  if (!r.ok) throw new Error(`X ${path.split("?")[0]} ${r.status}`);
  return r.json();
}
const FIELDS = "tweet.fields=author_id,conversation_id,in_reply_to_user_id,referenced_tweets,attachments&expansions=attachments.media_keys&media.fields=type,url,preview_image_url,variants,duration_ms";

/** Reply as the bot. Always records the outcome (shown on the admin card). */
async function reply(toId: string, text: string) {
  let note: string;
  try {
    const b = await botToken();
    if (!b) note = "bot not connected";
    else {
      const r = await fetch(`${API}/tweets`, { method: "POST", headers: { authorization: `Bearer ${b.access}`, "content-type": "application/json" }, body: JSON.stringify({ text, reply: { in_reply_to_tweet_id: toId } }) });
      if (r.ok) { await setState("x_reply_last", stamp("ok")); return true; }
      note = `X ${r.status}: ${(await r.text()).slice(0, 200)}`;
    }
  } catch (e) { note = (e as Error).message; }
  await setState("x_reply_last", stamp(note));
  return false;
}
// Text only, no link (owner's choice). The post id makes each reply unique: X rejects a reply identical to an earlier one.
const addedText = (postId: string, trimmedTo: number | null) =>
  `Added to Arctisans ✓${trimmedTo ? ` Video trimmed to ${Math.floor(trimmedTo / 60)}:${String(trimmedTo % 60).padStart(2, "0")} to fit.` : ""} (ref ${postId.slice(0, 5)})`;
// X refuses a reply identical to an earlier one, so refusals carry a short reference that differs per post.
const refusedText = (tweetId: string, why: string) => `Couldn't add this to Arctisans: ${why.slice(0, 140)}. (ref ${tweetId.slice(-5)})`;

/** Re-send confirmations that did not go out (bot was offline, X hiccup). Newest first, last 2 days. */
async function retryReplies() {
  const rows = (await db().execute({ sql: "SELECT tweet_id, post_id, reason FROM x_imports WHERE status='imported' AND replied=0 AND post_id IS NOT NULL AND created_at > ? ORDER BY created_at DESC LIMIT 5", args: [Date.now() - 2 * 86400_000] })).rows;
  for (const r of rows) {
    const trimmed = /^trimmed:(\d+)/.exec(String(r.reason ?? ""));
    if (await reply(String(r.tweet_id), addedText(String(r.post_id), trimmed ? Number(trimmed[1]) : null))) await db().execute({ sql: "UPDATE x_imports SET replied=1 WHERE tweet_id=?", args: [String(r.tweet_id)] });
    else break; // the bot is down: stop, try again next run
  }
}

async function importMedia(media: XMedia[]): Promise<{ images: string[]; video: string | null; trimmedTo: number | null }> {
  const vid = media.find((x) => x.type === "video" || x.type === "animated_gif");
  if (vid) {
    const { buf, trimmedTo } = await fitVideo(vid);
    const name = `x-${crypto.randomUUID()}.mp4`;
    if (!process.env.BLOB_READ_WRITE_TOKEN && process.env.UPLOAD_DIR) { // local tests only
      const { mkdir, writeFile } = await import("node:fs/promises");
      await mkdir(process.env.UPLOAD_DIR, { recursive: true }); await writeFile(`${process.env.UPLOAD_DIR}/${name}`, buf);
      return { images: [], video: `/local/${name}`, trimmedTo };
    }
    const { url } = await put(`videos/${name}`, buf, { access: "public", contentType: "video/mp4" });
    return { images: [], video: url, trimmedTo };
  }
  const photos = media.filter((x) => x.type === "photo" && x.url).slice(0, 3);
  const refs: string[] = [];
  for (const p of photos) {
    const r = await fetch(`${p.url}?name=large`); if (!r.ok) throw new Error(`could not download the picture (${r.status})`);
    refs.push(await storeImage(await processImage(Buffer.from(await r.arrayBuffer()))));
  }
  return { images: refs, video: null, trimmedTo: null };
}

/** Handle one mention end to end. Returns a short result line. Never throws. */
async function processMention(m: XTweet, media: Map<string, XMedia>, handle: string): Promise<string> {
  const done = (await db().execute({ sql: "SELECT status, attempts FROM x_imports WHERE tweet_id=?", args: [m.id] })).rows[0];
  if (done && String(done.status) === "imported") return "already imported";
  const attempts = done ? Number(done.attempts ?? 0) : 0;
  const link = (await db().execute({ sql: "SELECT wallet, x_id FROM x_links WHERE x_id=?", args: [m.author_id] })).rows[0];
  const wallet = link ? String(link.wallet) : null;
  const record = (status: string, reason: string, postId: string | null = null, replied = 1) =>
    db().execute({ sql: "INSERT INTO x_imports(tweet_id,wallet,post_id,status,reason,created_at,replied,attempts) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(tweet_id) DO UPDATE SET wallet=excluded.wallet, post_id=excluded.post_id, status=excluded.status, reason=excluded.reason, replied=excluded.replied, attempts=excluded.attempts",
      args: [m.id, wallet, postId, status, reason.slice(0, 200), Date.now(), replied, status === "failed" ? attempts + 1 : attempts] });
  const isCommand = TRIGGER(handle).test(m.text);
  try {
    let parent: XTweet | null = null, parentMedia: XMedia[] = [];
    const rt = m.referenced_tweets?.find((r) => r.type === "replied_to");
    if (link && rt && isCommand && !m.attachments?.media_keys?.length) {
      const p = (await bearer(`/tweets/${rt.id}?${FIELDS}`)) as { data: XTweet; includes?: { media?: XMedia[] } };
      parent = p.data; parentMedia = p.includes?.media ?? [];
    }
    const pick = pickImport(m, parent, { linkedXId: link ? String(link.x_id) : null, handle });
    if (!pick.ok) {
      await record("refused", pick.reason);
      if (isCommand) await reply(m.id, refusedText(m.id, pick.reason));
      return `refused: ${pick.reason}`;
    }
    const src = pick.source;
    const dup = (await db().execute({ sql: "SELECT post_id FROM x_imports WHERE tweet_id=? AND status='imported' AND post_id IS NOT NULL", args: [src.id] })).rows[0];
    if (dup && src.id !== m.id) {
      await record("imported", "already imported", String(dup.post_id));
      return "already imported";
    }
    const pool = src === m ? media : new Map(parentMedia.map((x) => [x.media_key, x]));
    const items = (src.attachments?.media_keys ?? []).map((k) => pool.get(k)).filter((x): x is XMedia => !!x);
    const { images, video, trimmedTo } = items.length ? await importMedia(items) : { images: [] as string[], video: null, trimmedTo: null };
    const id = crypto.randomUUID(), body = cleanCaption(src.text, handle);
    const hash = keccak256(toBytes(JSON.stringify({ id, wallet, body, x: src.id })));
    await db().execute({ sql: "INSERT INTO posts(id,author_wallet,feed,body,images,video,skill,city,hash,budget,created_at,source_url) VALUES(?,?,'work',?,?,?,NULL,NULL,?,NULL,?,?)",
      args: [id, wallet, body, JSON.stringify(images), video, hash, Date.now(), `https://x.com/i/status/${src.id}`] });
    await record("imported", trimmedTo ? `trimmed:${trimmedTo}` : "ok", id, 0);
    if (src.id !== m.id) await db().execute({ sql: "INSERT OR IGNORE INTO x_imports(tweet_id,wallet,post_id,status,reason,created_at,replied,attempts) VALUES(?,?,?,'imported','source of a command reply',?,1,0)", args: [src.id, wallet, id, Date.now()] });
    await db().execute({ sql: "INSERT INTO notifications(id,wallet,kind,data,created_at) VALUES(?,?,?,?,?)", args: [crypto.randomUUID(), wallet, "x_import", JSON.stringify({ postId: id }), Date.now()] });
    if (await reply(m.id, addedText(id, trimmedTo))) await db().execute({ sql: "UPDATE x_imports SET replied=1 WHERE tweet_id=?", args: [m.id] });
    return `imported as ${id}${trimmedTo ? ` (trimmed to ${trimmedTo}s)` : ""}`;
  } catch (e) {
    const msg = (e as Error).message;
    await record("failed", msg);
    // Tell the person only once it is final (3rd failure), so a passing X hiccup doesn't spam them.
    if (isCommand && attempts + 1 >= 3) await reply(m.id, refusedText(m.id, `${msg}, try again later`));
    return `failed (try ${attempts + 1}/3): ${msg}`;
  }
}

/** Poll mentions and import qualifying posts. One run at a time; failed imports are retried on later runs. */
export async function pollMentions() {
  if (!xConfigured() || !process.env.X_BEARER_TOKEN) return { skipped: "X not configured" };
  await xMigrate();
  if (!(await claim("x_poll_lock", 310_000))) return { skipped: "another check is running" };
  const out: { tweet: string; result: string }[] = [];
  try {
    const handle = botHandle();
    let botId = await getState("x_bot_id");
    if (!botId) { botId = ((await bearer(`/users/by/username/${handle}`)) as { data: { id: string } }).data.id; await setState("x_bot_id", botId); }
    // New mentions since the last one we saw (up to 3 pages), handled oldest first.
    const since = await getState("x_since_v3");
    const found: XTweet[] = []; const media = new Map<string, XMedia>(); let newest: string | null = null, page: string | null = null;
    for (let i = 0; i < 3; i++) {
      const res = (await bearer(`/users/${botId}/mentions?max_results=50&${FIELDS}${since ? `&since_id=${since}` : ""}${page ? `&pagination_token=${page}` : ""}`)) as { data?: XTweet[]; includes?: { media?: XMedia[] }; meta?: { newest_id?: string; next_token?: string } };
      found.push(...(res.data ?? [])); for (const x of res.includes?.media ?? []) media.set(x.media_key, x);
      newest ??= res.meta?.newest_id ?? null; page = res.meta?.next_token ?? null;
      if (!page || !since) break; // first ever run: only the latest page, never crawl old history
    }
    for (const m of found.reverse()) out.push({ tweet: m.id, result: await processMention(m, media, handle) });
    if (newest) await setState("x_since_v3", newest);

    // Retry recent failures (X hiccup, download error): at most 3 tries each, 3 per run.
    const retry = (await db().execute({ sql: "SELECT tweet_id FROM x_imports WHERE status='failed' AND attempts < 3 AND created_at > ? ORDER BY created_at ASC LIMIT 3", args: [Date.now() - 2 * 86400_000] })).rows;
    for (const r of retry) {
      const id = String(r.tweet_id);
      if (out.some((o) => o.tweet === id)) continue;
      const t = (await bearer(`/tweets/${id}?${FIELDS}`)) as { data: XTweet; includes?: { media?: XMedia[] } };
      out.push({ tweet: id, result: `retry: ${await processMention(t.data, new Map((t.includes?.media ?? []).map((x) => [x.media_key, x])), handle)}` });
    }
    await retryReplies().catch(() => {});
    await setState("x_poll_last", stamp(`ok, ${found.length} new${out.length ? `: ${out.map((o) => o.result.split(" as ")[0].split(":")[0]).join(", ")}` : ""}`));
    return { checked: found.length, out };
  } catch (e) {
    await setState("x_poll_last", stamp(`ERROR: ${(e as Error).message}`));
    throw e;
  } finally { await release("x_poll_lock"); }
}

/**
 * Opportunistic check: after a feed or X-settings load, at most once per 45 s across all servers, ask the poll endpoint
 * to run (it has its own 5-minute time budget, enough to cut long videos). The GitHub timer is the quiet-time backstop.
 */
export async function maybePoll(minGapMs = 45_000) {
  if (!xConfigured() || !process.env.X_BEARER_TOKEN || !process.env.X_POLL_SECRET) return null;
  await xMigrate();
  if (!(await claim("x_last_poll", minGapMs))) return null;
  await fetch(`${APP()}/api/x/poll`, { headers: { authorization: `Bearer ${process.env.X_POLL_SECRET}` }, signal: AbortSignal.timeout(4000) }).catch(() => {});
  return true;
}

/** Run the opportunistic check after the response. Never throws, and does nothing outside a web request (tests, scripts). */
export function pollSoon(minGapMs = 45_000) {
  try { void import("next/server").then(({ after }) => after(() => maybePoll(minGapMs).catch((e) => console.error("[x-poll]", e)))).catch(() => {}); } catch { /* not in a request */ }
}
