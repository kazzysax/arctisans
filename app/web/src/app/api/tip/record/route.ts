import { z } from "zod";
import { parseEventLogs } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { client } from "@/lib/indexer";
import { USDC } from "@/lib/chain";
import { erc20Abi } from "@/lib/abi_ext";
import { MIN_TIP, CONTRACT_MIN_TIP } from "@/lib/money";

const B = z.object({ hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/), postId: z.string().uuid().optional() });

/**
 * Records a small tip ($0.10 to under $0.50), which goes as a plain USDC transfer.
 * Nothing is trusted from the browser: we read the receipt and only count a real USDC transfer
 * from the signed-in person to someone with a profile.
 */
export const POST = route("tip-record", 30, async (req) => {
  const { wallet } = requireSession(req);
  const b = B.parse(await req.json());
  const rcpt = await client().getTransactionReceipt({ hash: b.hash as `0x${string}` }).catch(() => null);
  if (!rcpt || rcpt.status !== "success") return fail(409, "That transaction has not landed yet");
  const blk = await client().getBlock({ blockNumber: rcpt.blockNumber });
  const logs = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: rcpt.logs.filter((l) => l.address.toLowerCase() === USDC.toLowerCase()) });
  let n = 0;
  for (const l of logs) {
    const from = l.args.from.toLowerCase(), to = l.args.to.toLowerCase(), amount = Number(l.args.value);
    if (from !== wallet || amount < MIN_TIP || amount >= CONTRACT_MIN_TIP) continue; // bigger tips are recorded by the contract event
    const dest = await db().execute({ sql: "SELECT wallet FROM users WHERE wallet=?", args: [to] });
    if (!dest.rows.length) continue;
    let postHash: string | null = null;
    if (b.postId) {
      const p = await db().execute({ sql: "SELECT hash FROM posts WHERE id=? AND author_wallet=?", args: [b.postId, to] });
      if (p.rows.length) postHash = String(p.rows[0].hash);
    }
    const r = await db().execute({ sql: "INSERT OR IGNORE INTO tips(id,from_wallet,to_wallet,post_hash,amount,ts) VALUES(?,?,?,?,?,?)", args: [`${b.hash}:${l.logIndex}`, from, to, postHash, amount, Number(blk.timestamp)] });
    if (r.rowsAffected) n++;
  }
  return n ? ok({ recorded: n }) : fail(400, "No tip found in that transaction");
});
