import { createWalletClient, http, parseAbi, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { db } from "@/db";
import { arc, USDC } from "@/lib/chain";

/**
 * Launch gift: the first 10 people who sign up after REWARD_START get a small USDC gift in their wallet
 * the first time they publish a post. Sent silently: the app never shows or announces the amount.
 * One gift per wallet (the row is claimed before sending), paid from a dedicated wallet so the most it
 * can ever spend is what is put in it.
 */
export const REWARD_SLOTS = 10;
const AMOUNT = 200_000n; // 0.20 USDC, 6 decimals
const abi = parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]);

export async function maybeReward(wallet: string, postId: string): Promise<"paid" | "skipped" | "failed"> {
  const key = process.env.REWARD_KEY as Hex | undefined;
  const start = Number(process.env.REWARD_START ?? 0);
  if (!key || !start) return "skipped";
  const w = wallet.toLowerCase();
  // Among the first 10 sign-ups since the launch?
  const first = await db().execute({ sql: "SELECT wallet FROM users WHERE created_at>=? AND kind='human' ORDER BY created_at ASC LIMIT ?", args: [start, REWARD_SLOTS] });
  if (!first.rows.some((r) => String(r.wallet).toLowerCase() === w)) return "skipped";
  // Claim it once. A second post, or two posts at the same moment, cannot claim again.
  const claim = await db().execute({ sql: "INSERT OR IGNORE INTO rewards(wallet,post_id,status,created_at) VALUES(?,?,?,?)", args: [w, postId, "sending", Date.now()] });
  if (!claim.rowsAffected) return "skipped";
  try {
    const client = createWalletClient({ account: privateKeyToAccount(key), chain: arc, transport: http(process.env.RPC_URL ?? arc.rpcUrls.default.http[0]) });
    const tx = await client.writeContract({ address: USDC, abi, functionName: "transfer", args: [w as Hex, AMOUNT] });
    await db().execute({ sql: "UPDATE rewards SET status='paid', tx=? WHERE wallet=?", args: [tx, w] });
    return "paid";
  } catch {
    await db().execute({ sql: "DELETE FROM rewards WHERE wallet=? AND status='sending'", args: [w] }); // let the next post try again
    return "failed";
  }
}

/**
 * Safety net, run by the poller: anyone who qualifies and has posted by any route (app, or migrated from X)
 * but was never paid gets paid now. Safe to run often: one gift per wallet, only the first 10 sign-ups.
 */
export async function rewardCatchUp(): Promise<number> {
  const start = Number(process.env.REWARD_START ?? 0);
  if (!process.env.REWARD_KEY || !start) return 0;
  const r = await db().execute({
    sql: `SELECT p.author_wallet AS w, MIN(p.id) AS pid FROM posts p JOIN users u ON u.wallet = p.author_wallet
          WHERE u.created_at >= ? AND u.kind = 'human' AND p.hidden = 0
            AND lower(p.author_wallet) NOT IN (SELECT wallet FROM rewards)
          GROUP BY p.author_wallet LIMIT ?`,
    args: [start, REWARD_SLOTS],
  });
  let paid = 0;
  for (const row of r.rows) if ((await maybeReward(String(row.w), String(row.pid)).catch(() => "failed")) === "paid") paid++;
  return paid;
}
