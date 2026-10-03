import { db, migrate } from "@/db";
import { createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arc } from "./chain";
import { arctisanEscrowAbi } from "./abi";
import { client } from "./indexer";
import { env } from "./env";

const SILENCE = 3 * 86400, DEADLOCK = 48 * 3600, GRACE = 3 * 86400;

/** Jobs whose timer has run out. The contract lets ANYONE poke these, so the keeper is only a convenience. */
export async function dueJobs(nowSec = Math.floor(Date.now() / 1000)) {
  await migrate();
  // Status and clock come from the event stream: last state-changing event time per job.
  const r = await db().execute(`
    SELECT j.chain_job_id AS id, j.status AS status, json_extract(j.terms, '$.deadline') AS deadline,
      (SELECT COUNT(*) FROM chain_events e2 WHERE e2.contract='escrow' AND json_extract(e2.args,'$.jobId')=CAST(j.chain_job_id AS TEXT) AND e2.name='RevisionRequested') AS revs,
      (SELECT MAX(ts) FROM chain_events e WHERE e.contract='escrow' AND json_extract(e.args,'$.jobId')=CAST(j.chain_job_id AS TEXT)
         AND e.name IN ('JobStarted','ProgressPosted','Delivered','RevisionRequested','SettlementOpened','TermsAgreed','JobFunded')) AS last
    FROM jobs j WHERE j.chain_job_id IS NOT NULL AND j.status IN ('Active','Delivered','Settlement')`);
  const out: { id: number; why: string }[] = [];
  for (const x of r.rows) {
    const last = Number(x.last ?? 0); if (!last) continue;
    const s = String(x.status);
    // Hard deadline: agreed date + 3 days. Updates cannot keep an unfinished first delivery alive past it (revisions are exempt).
    if (s === "Active" && Number(x.revs) === 0 && Number(x.deadline) && nowSec > Number(x.deadline) + GRACE) { out.push({ id: Number(x.id), why: "agreed date + 3 days passed" }); continue; }
    if ((s === "Active" || s === "Delivered") && nowSec > last + SILENCE) out.push({ id: Number(x.id), why: s === "Active" ? "artisan silent 3 days" : "client silent 3 days" });
    if (s === "Settlement" && nowSec > last + DEADLOCK) out.push({ id: Number(x.id), why: "deadlock window over" });
  }
  return out;
}

/** Sends poke() for each due job using a small gas-only keeper key (KEEPER_PRIVATE_KEY). It holds no user money. */
export async function runKeeper() {
  const due = await dueJobs();
  const pk = process.env.KEEPER_PRIVATE_KEY as Hex | undefined;
  if (!pk || due.length === 0) return { due, sent: [] as string[] };
  const account = privateKeyToAccount(pk);
  const wallet = createWalletClient({ account, chain: arc, transport: http(process.env.RPC_URL ?? arc.rpcUrls.default.http[0]) });
  const pub = client(), sent: string[] = [];
  for (const d of due) {
    try {
      await pub.simulateContract({ account, address: env.escrow(), abi: arctisanEscrowAbi, functionName: "poke", args: [BigInt(d.id)] }); // skip if it would revert
      sent.push(await wallet.writeContract({ address: env.escrow(), abi: arctisanEscrowAbi, functionName: "poke", args: [BigInt(d.id)], maxFeePerGas: 30_000_000_000n }));
    } catch { /* not due on-chain yet; try next run */ }
  }
  return { due, sent };
}
