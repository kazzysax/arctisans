import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { cleanIdea, BLOCKED } from "@/lib/dreams/core";
import { treasury } from "@/lib/dreams/store";
import { USDC } from "@/lib/chain";
import { encodeFunctionData } from "viem";
import { erc20Abi } from "@/lib/abi_ext";
import { ENTRY_MICRO } from "@/lib/dreams/core";

/** Start a dream: saves the one-liner and returns the $1 payment call. Money is only counted once the receipt is read. */
export const POST = route("dream-new", 10, async (req) => {
  const { wallet } = requireSession(req);
  const b = z.object({ idea: z.string().min(12, "Describe your idea in one line (at least 12 characters)").max(600) }).parse(await req.json());
  const idea = cleanIdea(b.idea);
  if (idea.length < 12) return fail(400, "Describe your idea in one line (at least 12 characters)");
  if (BLOCKED.test(idea)) return fail(400, "The dogs can't plan that one. Arc Studio's terms don't allow apps built to defraud or harm people. Try a different idea.");
  const open = await db().execute({ sql: "SELECT COUNT(*) n FROM dreams WHERE wallet=? AND status='new' AND created_at>?", args: [wallet, Date.now() - 3_600_000] });
  if (Number(open.rows[0].n) >= 3) return fail(429, "You have 3 unpaid dreams waiting. Pay one first.");
  const id = crypto.randomUUID();
  await db().execute({ sql: "INSERT INTO dreams(id,wallet,idea,created_at,updated_at) VALUES(?,?,?,?,?)", args: [id, wallet, idea, Date.now(), Date.now()] });
  const data = encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [treasury() as `0x${string}`, BigInt(ENTRY_MICRO)] });
  return ok({ id, calls: [{ to: USDC, data, label: "Enter the arena ($1 USDC)" }] });
});

export const GET = route("dream-list", 60, async (req) => {
  const { wallet } = requireSession(req);
  const r = await db().execute({ sql: "SELECT id, idea, status, created_at FROM dreams WHERE wallet=? ORDER BY created_at DESC LIMIT 20", args: [wallet] });
  return ok({ dreams: r.rows.map((x) => ({ id: String(x.id), idea: String(x.idea), status: String(x.status), at: Number(x.created_at) })) });
});
