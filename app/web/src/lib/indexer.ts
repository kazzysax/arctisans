import { createPublicClient, http, decodeEventLog, type Log } from "viem";
import { arc } from "./chain";
import { arctisanEscrowAbi, arctisanSocialAbi } from "./abi";
import { env } from "./env";
import { db, migrate } from "@/db";

const STATUS = ["None","Proposed","Agreed","Funded","Active","Delivered","Settlement","Completed","Settled","Deadlocked","Abandoned","Cancelled"];

export function client() {
  return createPublicClient({ chain: arc, transport: http(process.env.RPC_URL ?? arc.rpcUrls.default.http[0]) });
}

type Ev = { name: string; args: Record<string, unknown> };
function decode(contract: "escrow" | "social", log: Log): Ev | null {
  try {
    const abi = contract === "escrow" ? arctisanEscrowAbi : arctisanSocialAbi;
    const d = decodeEventLog({ abi, data: log.data, topics: log.topics });
    return { name: d.eventName as string, args: d.args as Record<string, unknown> };
  } catch { return null; }
}
const ser = (v: unknown) => JSON.stringify(v, (_, x) => (typeof x === "bigint" ? x.toString() : x));
const lc = (s: unknown) => String(s).toLowerCase();

async function notify(wallet: string, kind: string, data: unknown) {
  await db().execute({ sql: "INSERT INTO notifications(id,wallet,kind,data,created_at) VALUES(?,?,?,?,?)", args: [crypto.randomUUID(), lc(wallet), kind, ser(data), Date.now()] });
}

/** Apply one decoded event to the read model. Idempotent: the event id is unique, so replays are no-ops. */
export async function applyEvent(contract: "escrow" | "social", ev: Ev, meta: { block: number; tx: string; logIndex: number; ts: number }) {
  await migrate();
  const id = `${meta.tx}:${meta.logIndex}`;
  const ins = await db().execute({
    sql: "INSERT OR IGNORE INTO chain_events(id,block,tx,contract,name,args,ts) VALUES(?,?,?,?,?,?,?)",
    args: [id, meta.block, meta.tx, contract, ev.name, ser(ev.args), meta.ts],
  });
  if (ins.rowsAffected === 0) return false; // already applied
  const a = ev.args as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const setStatus = (jobId: unknown, s: string) =>
    db().execute({ sql: "UPDATE jobs SET status=? WHERE chain_job_id=?", args: [s, Number(jobId)] });

  if (contract === "escrow") {
    switch (ev.name) {
      case "JobProposed":
        // Link the on-chain job to the stored terms by hash.
        await db().execute({ sql: "UPDATE jobs SET chain_job_id=?, status='Proposed' WHERE terms_hash=?", args: [Number(a.jobId), lc(a.termsHash)] });
        await notify(lc(a.proposer) === lc(a.client) ? a.artisan : a.client, "job_proposed", { jobId: Number(a.jobId) });
        break;
      case "TermsAgreed": await setStatus(a.jobId, "Agreed"); break;
      case "JobFunded": await setStatus(a.jobId, "Funded"); await notifyParty(a.jobId, "artisan", "job_funded"); break;
      case "JobStarted": await setStatus(a.jobId, "Active"); break;
      case "ProgressPosted": break;
      case "Delivered": await setStatus(a.jobId, "Delivered"); await notifyParty(a.jobId, "client", "delivered"); break;
      case "RevisionRequested": await setStatus(a.jobId, "Active"); await notifyParty(a.jobId, "artisan", "revision_requested"); break;
      case "Released": await notify(a.to, "payment_released", { jobId: Number(a.jobId), net: Number(a.net) }); break;
      case "SettlementOpened": await setStatus(a.jobId, "Settlement"); await notifyParty(a.jobId, "client", "settlement_opened"); await notifyParty(a.jobId, "artisan", "settlement_opened"); break;
      case "SplitOffered": await notifyParty(a.jobId, lc(a.by) === (await partyOf(a.jobId, "client")) ? "artisan" : "client", "split_offered"); break;
      case "JobClosed":
        await setStatus(a.jobId, STATUS[Number(a.outcome)] ?? "Closed");
        break;
    }
  } else if (ev.name === "Tipped") {
    await db().execute({ sql: "INSERT OR IGNORE INTO tips(id,from_wallet,to_wallet,post_hash,amount,ts) VALUES(?,?,?,?,?,?)", args: [id, lc(a.from), lc(a.to), a.postHash, Number(a.amount), meta.ts] });
    await notify(a.to, "tip", { amount: Number(a.amount), from: lc(a.from) });
  } else if (ev.name === "Reviewed") {
    await db().execute({ sql: "INSERT OR IGNORE INTO reviews(id,job_chain_id,reviewer,subject,rating,review_hash,created_at) VALUES(?,?,?,?,?,?,?)", args: [id, Number(a.jobId), lc(a.reviewer), lc(a.subject), Number(a.rating), a.reviewHash, meta.ts] });
    await notify(a.subject, "review", { jobId: Number(a.jobId), rating: Number(a.rating) });
  }
  return true;
}
async function partyOf(jobId: unknown, who: "client" | "artisan") {
  const r = await db().execute({ sql: `SELECT ${who} AS w FROM jobs WHERE chain_job_id=?`, args: [Number(jobId)] });
  return r.rows[0] ? lc(r.rows[0].w) : "";
}
async function notifyParty(jobId: unknown, who: "client" | "artisan", kind: string) {
  const w = await partyOf(jobId, who);
  if (w) await notify(w, kind, { jobId: Number(jobId) });
}

/** Read a transaction receipt right after the user acts, so the UI updates immediately. */
export async function indexTx(hash: `0x${string}`) {
  const c = client();
  const rcpt = await c.getTransactionReceipt({ hash });
  const blk = await c.getBlock({ blockNumber: rcpt.blockNumber });
  let n = 0;
  for (const log of rcpt.logs) {
    const which = lc(log.address) === lc(env.escrow()) ? "escrow" : lc(log.address) === lc(env.social()) ? "social" : null;
    if (!which) continue;
    const ev = decode(which, log);
    if (ev && (await applyEvent(which, ev, { block: Number(rcpt.blockNumber), tx: hash, logIndex: log.logIndex ?? 0, ts: Number(blk.timestamp) }))) n++;
  }
  return n;
}

/** Catch-up poller: scans new blocks in chunks from the last saved block. */
export async function catchUp(maxBlocks = 5000n) {
  await migrate();
  const c = client();
  const head = await c.getBlockNumber();
  const row = await db().execute("SELECT v FROM chain_state WHERE k='last_block'");
  const start = row.rows[0] ? BigInt(String(row.rows[0].v)) + 1n : BigInt(process.env.START_BLOCK ?? head);
  if (start > head) return { from: Number(start), to: Number(head), events: 0 };
  const to = start + maxBlocks < head ? start + maxBlocks : head;
  let events = 0;
  for (const [which, address] of [["escrow", env.escrow()], ["social", env.social()]] as const) {
    const logs = await c.getLogs({ address, fromBlock: start, toBlock: to });
    for (const log of logs) {
      const ev = decode(which, log);
      if (!ev) continue;
      const blk = await c.getBlock({ blockNumber: log.blockNumber! });
      if (await applyEvent(which, ev, { block: Number(log.blockNumber), tx: log.transactionHash!, logIndex: log.logIndex ?? 0, ts: Number(blk.timestamp) })) events++;
    }
  }
  await db().execute({ sql: "INSERT INTO chain_state(k,v) VALUES('last_block',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", args: [to.toString()] });
  return { from: Number(start), to: Number(to), events };
}
