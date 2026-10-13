import { parseEventLogs } from "viem";
import { db } from "@/db";
import { client } from "@/lib/indexer";
import { USDC } from "@/lib/chain";
import { erc20Abi } from "@/lib/abi_ext";
import { ENTRY_MICRO, MAX_CALLS, buildSheet, checkAnswer, Question, PlanCard, ResearchCard, type Answers } from "./core";
import { mochiQuestions, mochiPlan, scoutResearch } from "./llm";
import { nanoOn, payDog, payments } from "./nano";

/** Where the $1 goes: the Arctisans official account, unless DREAMS_TREASURY says otherwise. */
export const treasury = () => (process.env.DREAMS_TREASURY ?? "0x3edfd25cc190023eb62c4bec6a3d821f5339a189").toLowerCase();

export type Row = {
  id: string; wallet: string; idea: string; status: "new" | "paid" | "asking" | "planned" | "researched" | "ready";
  questions: Question[]; answers: Answers; plan: PlanCard | null; research: ResearchCard | null; sheet: string | null; skills: string[]; calls: number;
};
const J = <T,>(v: unknown, d: T): T => { try { return v ? (JSON.parse(String(v)) as T) : d; } catch { return d; } };
const toRow = (r: Record<string, unknown>): Row => ({
  id: String(r.id), wallet: String(r.wallet), idea: String(r.idea), status: String(r.status) as Row["status"],
  questions: J(r.questions, []), answers: J(r.answers, {}), plan: J(r.plan, null), research: J(r.research, null),
  sheet: r.sheet ? String(r.sheet) : null, skills: J(r.skills, []), calls: Number(r.calls),
});

/** For the paid dog endpoints, which are called by the other dog and have no user session. The dream id is a random UUID the server itself sent. */
export async function getDreamById(id: string): Promise<Row | null> {
  const r = await db().execute({ sql: "SELECT * FROM dreams WHERE id=?", args: [id] });
  return r.rows[0] ? toRow(r.rows[0] as Record<string, unknown>) : null;
}
export async function getDream(id: string, wallet: string): Promise<Row | null> {
  const r = await db().execute({ sql: "SELECT * FROM dreams WHERE id=? AND wallet=?", args: [id, wallet] });
  return r.rows[0] ? toRow(r.rows[0] as Record<string, unknown>) : null;
}
const save = (id: string, set: string, args: unknown[]) =>
  db().execute({ sql: `UPDATE dreams SET ${set}, updated_at=? WHERE id=?`, args: [...args, Date.now(), id] as never });

/** Reads the receipt and checks a real USDC transfer of at least $1 from this wallet to the treasury. */
export async function verifyEntry(hash: `0x${string}`, wallet: string): Promise<boolean> {
  const rcpt = await client().getTransactionReceipt({ hash }).catch(() => null);
  if (!rcpt || rcpt.status !== "success") return false;
  const logs = parseEventLogs({ abi: erc20Abi, eventName: "Transfer", logs: rcpt.logs.filter((l) => l.address.toLowerCase() === USDC.toLowerCase()) });
  return logs.some((l) => l.args.from.toLowerCase() === wallet && l.args.to.toLowerCase() === treasury() && Number(l.args.value) >= ENTRY_MICRO);
}

export async function markPaid(id: string, wallet: string, hash: string): Promise<"ok" | "used" | "missing"> {
  const d = await getDream(id, wallet);
  if (!d) return "missing";
  if (d.status !== "new") return "ok"; // already paid: safe to call twice
  try { await save(id, "status='paid', entry_tx=?", [hash.toLowerCase()]); } catch { return "used"; } // same receipt can't pay for two dreams
  return "ok";
}

const spend = (d: Row, n = 1) => { if (d.calls + n > MAX_CALLS) throw new Error("Over the limit of dog calls for one dream."); };

/** Checks every question was answered with listed options. Returns the clean answers, or throws a message safe to show. */
function collect(qs: Question[], got: Record<string, { optionIds: string[] }> | undefined): Answers {
  const out: Answers = {};
  for (const q of qs) {
    const r = checkAnswer(q, got?.[q.id]?.optionIds);
    if (!r.ok) throw new Error(r.error);
    out[q.id] = r.a;
  }
  return out;
}

/** Scout's work. Safe to run twice: if the research is already saved, nothing is spent. */
export async function doResearch(id: string): Promise<Row> {
  const d = (await getDreamById(id))!;
  if (d.status !== "planned") return d;
  spend(d);
  const research = await scoutResearch(d.idea, d.plan!);
  await save(d.id, "status='researched', research=?, calls=calls+1", [JSON.stringify(research)]);
  return { ...d, status: "researched", research, calls: d.calls + 1 };
}
/** Bolt's work: compile the Dream Sheet from the follow-up answers. Safe to run twice. */
export async function doCompile(id: string, follow: Answers): Promise<Row> {
  const d = (await getDreamById(id))!;
  if (d.status !== "researched") return d;
  const all: Answers = { ...d.answers, ...follow };
  const sheet = buildSheet(d.idea, d.plan!, d.research!, all);
  await save(d.id, "status='ready', answers=?, sheet=?, skills=?", [JSON.stringify(all), sheet.text, JSON.stringify(sheet.skills)]);
  return { ...d, status: "ready", answers: all, sheet: sheet.text, skills: sheet.skills };
}

/** Advances the dream one step. Each step is safe to repeat: if it already happened, the saved result is returned.
 *  paid -> asking (Mochi's 9 questions) -> planned (Plan Card) -> researched (Scout, with web search) -> ready (Dream Sheet). */
export async function advance(d: Row, got?: Record<string, { optionIds: string[] }>, origin?: string): Promise<Row> {
  if (d.status === "new") throw new Error("Only paid dreams can start");
  if (d.status === "paid") {
    spend(d);
    const qs = await mochiQuestions(d.idea);
    await save(d.id, "status='asking', questions=?, calls=calls+1", [JSON.stringify(qs)]);
    return { ...d, status: "asking", questions: qs, calls: d.calls + 1 };
  }
  if (d.status === "asking") {
    const clean = collect(d.questions, got);
    spend(d);
    const plan = await mochiPlan(d.idea, clean);
    await save(d.id, "status='planned', answers=?, plan=?, calls=calls+1", [JSON.stringify(clean), JSON.stringify(plan)]);
    return { ...d, status: "planned", answers: clean, plan, calls: d.calls + 1 };
  }
  if (d.status === "planned") {
    // Mochi pays Scout through Circle Nanopayments, and Scout does the work when the payment lands. Any failure falls back to doing it here.
    if (origin && nanoOn()) {
      try { await payDog(d.id, "scout", `${origin}/api/dreams/dog/scout`); } catch (e) { console.error("[dreams] scout payment failed, working without it:", (e as Error).message); }
      const again = (await getDreamById(d.id))!;
      if (again.status !== "planned") return again;
    }
    return doResearch(d.id);
  }
  if (d.status === "researched") {
    const follow = collect(d.research!.followups, got);
    if (origin && nanoOn()) {
      try { await payDog(d.id, "bolt", `${origin}/api/dreams/dog/bolt`); } catch (e) { console.error("[dreams] bolt payment failed, working without it:", (e as Error).message); }
    }
    return doCompile(d.id, follow);
  }
  return d; // ready: nothing more to do
}

/** What the browser may see: never the raw sheet before it is ready. */
export const view = (d: Row, pays: Awaited<ReturnType<typeof payments>> = []) => ({
  payments: pays,
  id: d.id, idea: d.idea, status: d.status,
  questions: d.status === "asking" ? d.questions : [],
  followups: d.status === "researched" ? d.research!.followups : [],
  plan: d.plan, research: d.research ? Object.fromEntries(Object.entries(d.research).filter(([k]) => k !== "followups")) : null,
  ready: d.status === "ready", skills: d.skills, callsLeft: Math.max(0, MAX_CALLS - d.calls),
});
