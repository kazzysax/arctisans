// X (Twitter) linkage: "@arctisans post this" imports YOUR OWN original X post to your Arctisans profile.
// Rules (enforced in pickImport): author must be the linked account; no retweets, quotes, or replies to someone
// else; must have uploaded media; each X post imports once.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { keccak256, toBytes } from "viem";
import { put } from "@vercel/blob";
import { db, migrate } from "@/db";
import { env } from "./env";
import { processImage, storeImage } from "./images";

const API = "https://api.x.com/2";
export const X_SCHEMA = [
  "CREATE TABLE IF NOT EXISTS x_links (wallet TEXT PRIMARY KEY, x_id TEXT NOT NULL UNIQUE, x_username TEXT NOT NULL, linked_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS x_imports (tweet_id TEXT PRIMARY KEY, wallet TEXT, post_id TEXT, status TEXT NOT NULL, reason TEXT, created_at INTEGER NOT NULL)",
  "CREATE TABLE IF NOT EXISTS x_oauth (state TEXT PRIMARY KEY, verifier TEXT NOT NULL, wallet TEXT NOT NULL, purpose TEXT NOT NULL, created_at INTEGER NOT NULL)",
];
export async function xMigrate() {
  await migrate(); for (const s of X_SCHEMA) await db().execute(s);
  // replied: 1 = nothing left to do (all old rows), 0 = import done but the confirmation reply on X has not gone out yet
  try {
    await db().execute("ALTER TABLE x_imports ADD COLUMN replied INTEGER NOT NULL DEFAULT 1");
    // one-time: the two posts imported before replies were tracked never got their confirmation on X
    await db().execute("UPDATE x_imports SET replied=0 WHERE tweet_id IN ('2107233803286544819','2107235813272551874') AND status='imported'");
  } catch { /* column exists */ }
}

export const xConfigured = () => !!(process.env.X_CLIENT_ID && process.env.X_CLIENT_SECRET);
export const botHandle = () => (process.env.X_BOT_HANDLE ?? "arctisans").replace(/^@/, "").toLowerCase();
const redirectUri = () => `${process.env.APP_URL ?? "https://arctisans.vercel.app"}/api/x/callback`;

// ---- small encrypted store for the bot's own tokens (kept in chain_state) ----
const key = () => createHash("sha256").update(`arctisans-x:${env.appSecret()}`).digest();
const enc = (s: string) => { const iv = randomBytes(12), c = createCipheriv("aes-256-gcm", key(), iv); const ct = Buffer.concat([c.update(s, "utf8"), c.final()]); return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64")).join("."); };
const dec = (s: string) => { const [iv, t, ct] = s.split(".").map((x) => Buffer.from(x, "base64")); const d = createDecipheriv("aes-256-gcm", key(), iv); d.setAuthTag(t); return Buffer.concat([d.update(ct), d.final()]).toString("utf8"); };
async function getState(k: string) { const r = await db().execute({ sql: "SELECT v FROM chain_state WHERE k=?", args: [k] }); return r.rows[0] ? String(r.rows[0].v) : null; }
async function setState(k: string, v: string) { await db().execute({ sql: "INSERT INTO chain_state(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", args: [k, v] }); }

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
  if (!r.ok) throw new Error(`X token ${r.status}`);
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

/** The bot's user token, refreshed when close to expiry. Null when the bot account was never connected. */
async function botToken(): Promise<{ id: string; access: string } | null> {
  const raw = await getState("x_bot");
  if (!raw) return null;
  const b = JSON.parse(dec(raw)) as { id: string; access: string; refresh?: string; exp: number };
  if (b.exp - Date.now() > 120_000) return b;
  if (!b.refresh) return null;
  // X refresh keys work ONCE. Only one process may renew at a time: claim a short lock, and if someone else holds it, wait for their result.
  await db().execute({ sql: "INSERT OR IGNORE INTO chain_state(k,v) VALUES('x_bot_lock','0')", args: [] });
  const now = Date.now();
  const got = await db().execute({ sql: "UPDATE chain_state SET v=? WHERE k='x_bot_lock' AND CAST(v AS INTEGER) < ?", args: [String(now), now - 30_000] });
  if (got.rowsAffected === 0) {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const again = await getState("x_bot");
      if (again) { const a = JSON.parse(dec(again)) as { id: string; access: string; exp: number }; if (a.exp - Date.now() > 120_000) return a; }
    }
    return null;
  }
  // re-read inside the lock: another process may have just renewed
  const cur = JSON.parse(dec((await getState("x_bot"))!)) as { id: string; access: string; refresh?: string; exp: number };
  if (cur.exp - Date.now() > 120_000) return cur;
  const t = await token({ grant_type: "refresh_token", refresh_token: cur.refresh ?? b.refresh, client_id: process.env.X_CLIENT_ID! });
  const nb = { id: b.id, access: t.access_token, refresh: t.refresh_token ?? b.refresh, exp: Date.now() + t.expires_in * 1000 };
  await setState("x_bot", enc(JSON.stringify(nb)));
  return nb;
}
export async function botStatus() { await xMigrate(); return { connected: !!(await getState("x_bot")), handle: botHandle() }; }

// ---- the rules ----
export type XTweet = {
  id: string; text: string; author_id: string; conversation_id?: string; in_reply_to_user_id?: string;
  referenced_tweets?: { type: "retweeted" | "quoted" | "replied_to"; id: string }[]; attachments?: { media_keys?: string[] };
};
export type XMedia = { media_key: string; type: "photo" | "video" | "animated_gif"; url?: string; preview_image_url?: string; variants?: { bit_rate?: number; content_type: string; url: string }[] };
export const TRIGGER = (handle: string) => new RegExp(`@${handle}\\b[^\\n]*\\bpost\\s+(this|it)\\b`, "i");

/**
 * Decide what (if anything) to import for one mention. Pure function: all lookups are passed in.
 * The source is either the mention itself (has media) or the post it replies to (when it's the same author's own post).
 */
export function pickImport(m: XTweet, parent: XTweet | null, opts: { linkedXId: string | null; handle: string }): { ok: true; source: XTweet } | { ok: false; reason: string } {
  if (!TRIGGER(opts.handle).test(m.text)) return { ok: false, reason: "no 'post this' command" };
  if (!opts.linkedXId) return { ok: false, reason: "X account not linked to Arctisans" };
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
  if (!r.ok) throw new Error(`X ${path.split("?")[0]} ${r.status}`);
  return r.json();
}
const FIELDS = "tweet.fields=author_id,conversation_id,in_reply_to_user_id,referenced_tweets,attachments&expansions=attachments.media_keys&media.fields=type,url,preview_image_url,variants";
/** Reply as the bot. Always records what happened (x_reply_last) so a silent failure can be diagnosed from the team page. */
async function reply(toId: string, text: string) {
  let note = "";
  try {
    const b = await botToken();
    if (!b) note = "bot not connected (or its login expired with no refresh token)";
    else {
      const r = await fetch(`${API}/tweets`, { method: "POST", headers: { authorization: `Bearer ${b.access}`, "content-type": "application/json" }, body: JSON.stringify({ text, reply: { in_reply_to_tweet_id: toId } }) });
      note = r.ok ? "ok" : `X ${r.status}: ${(await r.text()).slice(0, 220)}`;
      if (r.ok) { await setState("x_reply_last", `${new Date().toISOString()} ok`); return true; }
    }
  } catch (e) { note = `error: ${(e as Error).message}`; }
  await setState("x_reply_last", `${new Date().toISOString()} ${note}`);
  return false;
}
export async function lastReplyNote() { await xMigrate(); return (await getState("x_reply_last")) ?? "no reply attempted yet"; }

/** Retry confirmation replies that failed (e.g. the bot was offline). Capped, newest first, last 2 days. */
async function retryReplies() {
  const rows = (await db().execute({ sql: "SELECT i.tweet_id, i.wallet FROM x_imports i WHERE i.status='imported' AND i.replied=0 AND i.created_at > ? ORDER BY i.created_at DESC LIMIT 5", args: [Date.now() - 2 * 86400_000] })).rows;
  for (const r of rows) {
    const h = (await db().execute({ sql: "SELECT handle FROM users WHERE wallet=?", args: [String(r.wallet)] })).rows[0];
    if (await reply(String(r.tweet_id), `Added to your Arctisans profile: ${process.env.APP_URL ?? "https://arctisans.vercel.app"}/u/${h ? String(h.handle) : "me"}`)) await db().execute({ sql: "UPDATE x_imports SET replied=1 WHERE tweet_id=?", args: [String(r.tweet_id)] });
  }
}

async function importMedia(media: XMedia[]): Promise<{ images: string[]; video: string | null }> {
  const vid = media.find((x) => x.type === "video" || x.type === "animated_gif");
  if (vid) {
    // Best quality that fits our 20 MB limit: X offers several sizes of the same video (size known from the HEAD request).
    const LIMIT = 20 * 1024 * 1024;
    const options = (vid.variants ?? []).filter((v) => v.content_type === "video/mp4").sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0));
    if (!options.length) throw new Error("video has no mp4");
    let best: (typeof options)[number] | null = null;
    for (const o of options) {
      const h = await fetch(o.url, { method: "HEAD" }).catch(() => null);
      const size = Number(h?.headers.get("content-length") ?? 0);
      if (size > 0 && size <= LIMIT) { best = o; break; }
    }
    if (!best) throw new Error("video is too long (over 20 MB even in the smallest size)");
    const r = await fetch(best.url); if (!r.ok) throw new Error(`video ${r.status}`);
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length > LIMIT) throw new Error("video over 20 MB");
    const { url } = await put(`videos/x-${crypto.randomUUID()}.mp4`, buf, { access: "public", contentType: "video/mp4" });
    return { images: [], video: url };
  }
  const photos = media.filter((x) => x.type === "photo" && x.url).slice(0, 3);
  const refs: string[] = [];
  for (const p of photos) {
    const r = await fetch(`${p.url}?name=large`); if (!r.ok) throw new Error(`photo ${r.status}`);
    refs.push(await storeImage(await processImage(Buffer.from(await r.arrayBuffer()))));
  }
  return { images: refs, video: null };
}

/** Poll mentions of the bot and import qualifying posts. Bounded per run; every tweet is decided once. */
export async function pollMentions() {
  if (!xConfigured() || !process.env.X_BEARER_TOKEN) return { skipped: "X not configured" };
  await xMigrate();
  const handle = botHandle();
  let botId = await getState("x_bot_id");
  if (!botId) { botId = ((await bearer(`/users/by/username/${handle}`)) as { data: { id: string } }).data.id; await setState("x_bot_id", botId); }
  const since = await getState("x_since_v2");
  const res = (await bearer(`/users/${botId}/mentions?max_results=20&${FIELDS}${since ? `&since_id=${since}` : ""}`)) as { data?: XTweet[]; includes?: { media?: XMedia[] }; meta?: { newest_id?: string } };
  const out: { tweet: string; result: string }[] = [];
  const media = new Map((res.includes?.media ?? []).map((x) => [x.media_key, x]));
  for (const m of (res.data ?? []).reverse()) {
    // Posts refused under an older rule are retried once: only imported/failed ones are final.
    const seen = await db().execute({ sql: "SELECT 1 FROM x_imports WHERE tweet_id=? AND status='imported'", args: [m.id] });
    if (seen.rows.length) continue;
    await db().execute({ sql: "DELETE FROM x_imports WHERE tweet_id=? AND status IN ('refused','failed')", args: [m.id] });
    const link = (await db().execute({ sql: "SELECT wallet, x_id FROM x_links WHERE x_id=?", args: [m.author_id] })).rows[0];
    let parent: XTweet | null = null, parentMedia: XMedia[] = [];
    const rt = m.referenced_tweets?.find((r) => r.type === "replied_to");
    if (link && rt && !m.attachments?.media_keys?.length) {
      try { const p = (await bearer(`/tweets/${rt.id}?${FIELDS}`)) as { data: XTweet; includes?: { media?: XMedia[] } }; parent = p.data; parentMedia = p.includes?.media ?? []; } catch { parent = null; }
    }
    const pick = pickImport(m, parent, { linkedXId: link ? String(link.x_id) : null, handle });
    if (!pick.ok) {
      await db().execute({ sql: "INSERT INTO x_imports(tweet_id,wallet,status,reason,created_at) VALUES(?,?,'refused',?,?)", args: [m.id, link ? String(link.wallet) : null, pick.reason, Date.now()] });
      out.push({ tweet: m.id, result: `refused: ${pick.reason}` });
      if (link && TRIGGER(handle).test(m.text)) await reply(m.id, `Couldn't add this to Arctisans: ${pick.reason}.`).catch(() => false);
      continue;
    }
    const src = pick.source;
    const dup = await db().execute({ sql: "SELECT post_id FROM x_imports WHERE tweet_id=? AND status='imported'", args: [src.id] });
    if (dup.rows.length) { await db().execute({ sql: "INSERT INTO x_imports(tweet_id,wallet,status,reason,created_at) VALUES(?,?,'refused','already imported',?)", args: [m.id, String(link!.wallet), Date.now()] }); out.push({ tweet: m.id, result: "already imported" }); continue; }
    try {
      const pool = src === m ? media : new Map(parentMedia.map((x) => [x.media_key, x]));
      const items = (src.attachments?.media_keys ?? []).map((k) => pool.get(k)).filter((x): x is XMedia => !!x);
      const { images, video } = items.length ? await importMedia(items) : { images: [] as string[], video: null };
      const wallet = String(link!.wallet), id = crypto.randomUUID();
      const body = cleanCaption(src.text, handle);
      const hash = keccak256(toBytes(JSON.stringify({ id, wallet, body, x: src.id })));
      await db().execute({ sql: "INSERT INTO posts(id,author_wallet,feed,body,images,video,skill,city,hash,budget,created_at,source_url) VALUES(?,?,'work',?,?,?,NULL,NULL,?,NULL,?,?)",
        args: [id, wallet, body, JSON.stringify(images), video, hash, Date.now(), `https://x.com/i/status/${src.id}`] });
      await db().execute({ sql: "INSERT INTO x_imports(tweet_id,wallet,post_id,status,created_at) VALUES(?,?,?,'imported',?)", args: [src.id, wallet, id, Date.now()] });
      if (src.id !== m.id) await db().execute({ sql: "INSERT OR IGNORE INTO x_imports(tweet_id,wallet,post_id,status,reason,created_at) VALUES(?,?,?,'imported','command reply',?)", args: [m.id, wallet, id, Date.now()] });
      await db().execute({ sql: "INSERT INTO notifications(id,wallet,kind,data,created_at) VALUES(?,?,?,?,?)", args: [crypto.randomUUID(), wallet, "x_import", JSON.stringify({ postId: id }), Date.now()] });
      const h = (await db().execute({ sql: "SELECT handle FROM users WHERE wallet=?", args: [wallet] })).rows[0];
      await db().execute({ sql: "UPDATE x_imports SET replied=0 WHERE tweet_id=?", args: [m.id] });
      if (await reply(m.id, `Added to your Arctisans profile: ${process.env.APP_URL ?? "https://arctisans.vercel.app"}/u/${h ? String(h.handle) : "me"}`)) await db().execute({ sql: "UPDATE x_imports SET replied=1 WHERE tweet_id=?", args: [m.id] });
      out.push({ tweet: m.id, result: `imported as ${id}` });
    } catch (e) {
      await db().execute({ sql: "INSERT INTO x_imports(tweet_id,wallet,status,reason,created_at) VALUES(?,?,'failed',?,?)", args: [m.id, String(link!.wallet), String((e as Error).message).slice(0, 200), Date.now()] });
      await reply(m.id, `Couldn't add this to Arctisans: ${String((e as Error).message).slice(0, 120)}.`).catch(() => false);
      out.push({ tweet: m.id, result: `failed: ${(e as Error).message}` });
    }
  }
  if (res.meta?.newest_id) await setState("x_since_v2", res.meta.newest_id);
  await retryReplies().catch(() => {});
  return { checked: res.data?.length ?? 0, out };
}

/**
 * Opportunistic poll: called (after the response is sent) whenever someone loads the feed or the X settings page.
 * At most one check per 45 seconds across all servers, so imports land within ~a minute while the app is in use.
 * Empty checks cost no X credits (reads are charged per post returned). The GitHub timer stays as the quiet-time backstop.
 */
export async function maybePoll(minGapMs = 45_000) {
  if (!xConfigured() || !process.env.X_BEARER_TOKEN) return null;
  await xMigrate();
  const now = Date.now();
  await db().execute({ sql: "INSERT OR IGNORE INTO chain_state(k,v) VALUES('x_last_poll','0')", args: [] });
  const got = await db().execute({ sql: "UPDATE chain_state SET v=? WHERE k='x_last_poll' AND CAST(v AS INTEGER) < ?", args: [String(now), now - minGapMs] });
  if (got.rowsAffected === 0) return null;
  return pollMentions();
}

/** Run the opportunistic poll after the response. Never throws, and does nothing outside a web request (tests, scripts). */
export function pollSoon(minGapMs = 45_000) {
  try { void import("next/server").then(({ after }) => after(() => maybePoll(minGapMs).catch((e) => console.error("[x-poll]", e)))).catch(() => {}); } catch { /* not in a request */ }
}
