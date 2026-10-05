// Native agent worker. Runs server-side after any on-chain step is indexed (and from the cron). Each agent signs its
// own transactions from its own wallet; the same contract rules apply to it as to a person.
import { createWalletClient, http, keccak256, toBytes, type Hex } from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import { put } from "@vercel/blob";
import { db, migrate } from "@/db";
import { arc } from "../chain";
import { client, indexTx } from "../indexer";
import { buildJobCalls, type ActInput } from "../jobactions";
import { TermsSchema, hashTerms, defaultSplit, totalOf, type Terms } from "../terms";
import { proposeCalls, type Call } from "../tx";
import { NATIVE, nativeByHandle, type NativeDef } from "./agents";
import { chat, image } from "./llm";

type Agent = NativeDef & { account: PrivateKeyAccount; wallet: string };
type Row = Record<string, unknown>;
const lc = (s: unknown) => String(s).toLowerCase();
const log: string[] = [];
const say = (s: string) => { log.push(s); console.log(`[native] ${s}`); };

export function nativeAgents(): Agent[] {
  let keys: Record<string, string> = {};
  try { keys = JSON.parse(process.env.NATIVE_AGENT_KEYS ?? "{}"); } catch { return []; }
  return NATIVE.filter((d) => /^0x[0-9a-fA-F]{64}$/.test(keys[d.handle] ?? "")).map((d) => {
    const account = privateKeyToAccount(keys[d.handle] as Hex);
    return { ...d, account, wallet: account.address.toLowerCase() };
  });
}

/** Profiles are created on first run. Owner = the platform admin, shown on each profile. */
async function ensureProfiles(agents: Agent[]) {
  const owner = lc((process.env.ADMIN_WALLETS ?? "").split(",")[0].trim());
  for (const a of agents) {
    const cv = { craft: a.craft, availability: "open", rate: a.price / 1e6, tools: [], clients: [], portfolio: [] };
    const has = await db().execute({ sql: "SELECT 1 FROM users WHERE wallet=?", args: [a.wallet] });
    if (has.rows.length) {
      await db().execute({ sql: "UPDATE users SET display_name=?, title=?, bio=?, skills=?, avatar=?, cv=? WHERE wallet=?", args: [a.name, a.title, a.bio, JSON.stringify(a.skills), a.avatar, JSON.stringify(cv), a.wallet] });
      continue;
    }
    if ((await db().execute({ sql: "SELECT 1 FROM users WHERE lower(handle)=?", args: [a.handle] })).rows.length) { say(`handle @${a.handle} is taken, skipped`); continue; }
    await db().execute({
      sql: "INSERT INTO users(id,wallet,handle,display_name,kind,owner_wallet,title,bio,skills,avatar,cv,verified,created_at) VALUES(?,?,?,?,'agent',?,?,?,?,?,?,0,?)",
      args: [crypto.randomUUID(), a.wallet, a.handle, a.name, owner || null, a.title, a.bio, JSON.stringify(a.skills), a.avatar, JSON.stringify(cv), Date.now()],
    });
    say(`created profile @${a.handle}`);
  }
}

async function send(a: Agent, calls: Call[]) {
  const w = createWalletClient({ account: a.account, chain: arc, transport: http(process.env.RPC_URL ?? arc.rpcUrls.default.http[0]) });
  let last: Hex | null = null;
  for (const c of calls) {
    const hash = await w.sendTransaction({ to: c.to, data: c.data });
    const r = await client().waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`${c.label} reverted ${hash}`);
    last = hash;
  }
  if (last) await indexTx(last);
  return last;
}
async function act(a: Agent, j: Row, input: ActInput) {
  const h = await send(a, await buildJobCalls(j, a.wallet, input));
  say(`@${a.handle} ${input.action} job ${j.chain_job_id} (${h})`);
}
async function message(jobId: string, from: string, to: string, body: string) {
  const now = Date.now();
  await db().execute({ sql: "INSERT INTO job_messages(id,job_id,sender,body,created_at) VALUES(?,?,?,?,?)", args: [crypto.randomUUID(), jobId, from, body, now] });
  await db().execute({ sql: "INSERT INTO notifications(id,wallet,kind,data,created_at) VALUES(?,?,?,?,?)", args: [crypto.randomUUID(), to, "job_message", JSON.stringify({ jobId }), now] });
}
async function messages(jobId: string) {
  return (await db().execute({ sql: "SELECT sender, body FROM job_messages WHERE job_id=? ORDER BY created_at ASC LIMIT 100", args: [jobId] })).rows;
}
const terms = (j: Row): Terms => TermsSchema.parse(JSON.parse(String(j.terms)));

/** What the client asked for, in words: the agreed terms plus everything the client wrote in the job chat. */
async function request(j: Row) {
  const t = terms(j);
  const chatLines = (await messages(String(j.id))).filter((m) => lc(m.sender) === lc(j.client)).map((m) => `- ${m.body}`);
  return [`Title: ${t.title}`, t.description && `Details: ${t.description}`, `Deliverables: ${t.deliverables.join("; ")}`, `Done means: ${t.doneMeans}`, chatLines.length ? `Client messages:\n${chatLines.join("\n")}` : ""].filter(Boolean).join("\n");
}

async function makeImage(a: Agent, prompt: string) {
  const img = await image(`Square profile picture, 1:1, centered subject, soft light-blue background, clean modern illustration, no text, no watermark. ${prompt}`);
  const { url } = await put(`agents/${a.handle}/${crypto.randomUUID()}.${img.type.split("/")[1]}`, img.buf, { access: "public", contentType: img.type });
  return url;
}

/** Do the work for a funded, started job. Returns the delivery text, or null when waiting on a sub-hire. */
async function doWork(a: Agent, j: Row, all: Agent[]): Promise<string | null> {
  const req = await request(j);
  let extra = "";
  if (a.hires) {
    const helper = all.find((x) => x.handle === a.hires!.handle);
    const clientRow = (await db().execute({ sql: "SELECT avatar, display_name, title, bio, skills FROM users WHERE wallet=?", args: [lc(j.client)] })).rows[0];
    const needed = helper && helper.wallet !== lc(j.client) && (a.hires.when === "always" || !clientRow?.avatar);
    if (needed) {
      const sub = await subHire(a, helper!, j, `${a.hires.ask}.\n\n${req}${clientRow ? `\nAbout the client: ${clientRow.display_name}, ${clientRow.title ?? ""}. ${clientRow.bio ?? ""}` : ""}`);
      if (sub === null) return null; // still in progress
      extra = sub;
    }
  }
  if (a.handle === "portrait") {
    const url = await makeImage(a, req);
    return `Here is your picture: ${url}\nTo use it: save it, then Edit profile → photo. Want changes? Ask for a revision and say what to change.`;
  }
  if (a.handle === "cvdoctor") {
    const me = (await db().execute({ sql: "SELECT display_name, title, bio, skills, cv FROM users WHERE wallet=?", args: [lc(j.client)] })).rows[0];
    const profile = me ? `Current profile: name ${me.display_name}; title ${me.title ?? "(none)"}; bio ${me.bio ?? "(none)"}; skills ${me.skills}; cv ${me.cv}` : "No profile found.";
    const text = await chat(a.system, `${profile}\n\n${req}`);
    return extra ? `${text}\n\nProfile picture (made by @portrait for this job):\n${extra}` : text;
  }
  const text = await chat(a.system, req);
  return extra ? `${text}\n\nReady-to-post request (written by @wordsmith for this job):\n${extra}` : text;
}

/** Agent-to-agent: `a` hires `helper` through escrow for the parent job. Returns the helper's delivery once approved. */
async function subHire(a: Agent, helper: Agent, parent: Row, ask: string): Promise<string | null> {
  const tag = `[for job ${parent.id}]`;
  const r = await db().execute({ sql: "SELECT * FROM jobs WHERE client=? AND artisan=? AND terms LIKE ? ORDER BY created_at DESC LIMIT 1", args: [a.wallet, helper.wallet, `%${tag}%`] });
  let child = r.rows[0];
  if (!child) {
    const { upfront, milestones } = defaultSplit(helper.price, 0, 0);
    const t = TermsSchema.parse({ version: 1, client: a.account.address, artisan: helper.account.address, title: `${helper.name} for ${a.name}`, description: `${tag}\n${ask}`.slice(0, 2000),
      deliverables: [helper.handle === "portrait" ? "One profile picture" : "The requested text"], doneMeans: "Delivered in the job chat", skills: helper.skills.slice(0, 2), revisions: 0,
      deadline: Math.floor(Date.now() / 1000) + 2 * 86400, upfront, milestones, deadlockRule: "ToClient" });
    const id = crypto.randomUUID();
    await db().execute({ sql: "INSERT INTO jobs(id,client,artisan,terms,terms_hash,skills,status,created_at) VALUES(?,?,?,?,?,?,'Draft',?)", args: [id, a.wallet, helper.wallet, JSON.stringify(t), hashTerms(t), JSON.stringify(t.skills), Date.now()] });
    await message(String(parent.id), a.wallet, lc(parent.client), `I'm hiring @${helper.handle} for part of this job ($${(helper.price / 1e6).toFixed(2)}, paid by me through escrow).`);
    const h = await send(a, proposeCalls(t));
    say(`@${a.handle} hired @${helper.handle} for job ${parent.chain_job_id} (${h})`);
    return null;
  }
  if (String(child.status) === "Agreed") { await act(a, child, { action: "fund" }); return null; }
  if (String(child.status) === "Delivered") { await act(a, child, { action: "approveDelivery" }); child = (await db().execute({ sql: "SELECT * FROM jobs WHERE id=?", args: [child.id] })).rows[0]; }
  if (String(child.status) === "Completed") {
    const msgs = await messages(String(child.id));
    const d = msgs.filter((m) => lc(m.sender) === helper.wallet).at(-1);
    return d ? String(d.body).replace(/^Delivery:\n/, "") : "";
  }
  return null;
}

/** One pass for one agent as the hired side. */
async function serve(a: Agent, all: Agent[]) {
  const jobs = (await db().execute({ sql: "SELECT * FROM jobs WHERE artisan=? AND chain_job_id IS NOT NULL AND status IN ('Proposed','Funded','Active') ORDER BY created_at ASC LIMIT 20", args: [a.wallet] })).rows;
  for (const j of jobs) {
    try {
      const t = terms(j), status = String(j.status), cid = Number(j.chain_job_id);
      if (status === "Proposed") {
        const done = (await db().execute({ sql: "SELECT 1 FROM chain_events WHERE name='TermsAgreed' AND args LIKE ?", args: [`%"jobId":"${cid}"%`] })).rows.length;
        if (done) continue;
        if (totalOf(t) < a.price) { await message(String(j.id), a.wallet, lc(j.client), `My price is $${(a.price / 1e6).toFixed(2)}. Please propose again at that amount.`); await db().execute({ sql: "UPDATE jobs SET status='Declined' WHERE id=?", args: [j.id] }); continue; }
        if (t.deadline * 1000 < Date.now() + 3600_000) continue;
        await act(a, j, { action: "agree" });
        if (!all.some((x) => x.wallet === lc(j.client))) await message(String(j.id), a.wallet, lc(j.client), `Accepted. Fund the job and I'll start right away. Add any details here in the chat before funding.`);
      } else if (status === "Funded") {
        await act(a, j, { action: "start" });
      } else if (status === "Active") {
        const delivered = (await messages(String(j.id))).some((m) => lc(m.sender) === a.wallet && String(m.body).startsWith("Delivery:"));
        let text: string | null = null;
        if (!delivered) {
          text = await doWork(a, j, all);
          if (text === null) continue;
          await message(String(j.id), a.wallet, lc(j.client), `Delivery:\n${text}`);
        }
        await act(a, j, { action: "deliver", note: keccak256(toBytes(text ?? "delivered")) });
      }
    } catch (e) { say(`@${a.handle} job ${j.chain_job_id}: ${(e as Error).message.slice(0, 160)}`); }
  }
}

/** Run until nothing moves (agents hiring agents need several rounds), bounded. One run at a time. */
export async function runNative(maxRounds = 12) {
  log.length = 0;
  const agents = nativeAgents();
  if (!agents.length || !process.env.OPENROUTER_API_KEY) return { agents: 0, log: ["native agents not configured"] };
  await migrate();
  const now = Date.now();
  await db().execute({ sql: "INSERT OR IGNORE INTO chain_state(k,v) VALUES('native_lock','0')", args: [] });
  const got = await db().execute({ sql: "UPDATE chain_state SET v=? WHERE k='native_lock' AND CAST(v AS INTEGER) < ?", args: [String(now), now - 240_000] });
  if (got.rowsAffected === 0) return { agents: agents.length, log: ["busy"] };
  try {
    await ensureProfiles(agents);
    for (let i = 0; i < maxRounds; i++) {
      const before = log.length;
      for (const a of agents) await serve(a, agents);
      if (log.length === before) break;
    }
  } finally {
    await db().execute({ sql: "UPDATE chain_state SET v='0' WHERE k='native_lock'", args: [] });
  }
  return { agents: agents.length, log: [...log] };
}

/** Cheap check so request handlers only wake the worker for jobs that involve a native agent. */
export function touchesNative(wallets: string[]) {
  const mine = new Set(nativeAgents().map((a) => a.wallet));
  return wallets.some((w) => mine.has(lc(w)));
}
export { nativeByHandle };
