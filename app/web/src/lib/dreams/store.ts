import { parseEventLogs } from "viem";
import { db } from "@/db";
import { client } from "@/lib/indexer";
import { USDC } from "@/lib/chain";
import { erc20Abi } from "@/lib/abi_ext";
import { ENTRY_MICRO, MAX_CALLS, buildSheet, Question, PlanCard, ResearchCard, type Answers } from "./core";
import { mochiQuestions, mochiPlan, scoutResearch } from "./llm";

/** Where the $1 goes: the Arctisans official account, unless DREAMS_TREASURY says otherwise. */
export const treasury = () => (process.env.DREAMS_TREASURY ?? "0x3edfd25cc190023eb62c4bec6a3d821f5339a189").toLowerCase();

export type Row = {
  id: string; wallet: string; idea: string; status: "new" | "paid" | "asking" | "researched" | "ready";
  questions: Question[]; answers: Answers; plan: PlanCard | null; research: ResearchCard | null; sheet: string | null; skills: string[]; calls: number;
};
const J = <T,>(v: unknown, d: T): T => { try { return v ? (JSON.parse(String(v)) as T) : d; } catch { return d; } };
const toRow = (r: Record<string, unknown>): Row => ({
  id: String(r.id), wallet: String(r.wallet), idea: String(r.idea), status: String(r.status) as Row["status"],
  questions: J(r.questions, []), answers: J(r.answers, {}), plan: J(r.plan, null), research: J(r.research, null),
  sheet: r.sheet ? String(r.sheet) : null, skills: J(r.skills, []), calls: Number(r.calls),
});

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

const spend = (d: Row) => { if (d.calls >= MAX_CALLS) throw new Error("Over the limit of dog calls for one dream."); };

/** Advances the dream one step. Each step is safe to repeat: if it already happened, the saved result is returned. */
export async function advance(d: Row, answers?: Answers): Promise<Row> {
  if (d.status === "new") throw new Error("Only paid dreams can start");
  if (d.status === "paid") {
    spend(d);
    const qs = await mochiQuestions(d.idea);
    await save(d.id, "status='asking', questions=?, calls=calls+1", [JSON.stringify(qs)]);
    return { ...d, status: "asking", questions: qs, calls: d.calls + 1 };
  }
  if (d.status === "asking") {
    const got = answers ?? {};
    const miss = d.questions.filter((q) => !got[q.id]);
    if (miss.length) throw new Error("Only answered questions can go on: please answer every question.");
    const clean: Answers = {};
    for (const q of d.questions) { const o = q.options.find((x) => x.id === got[q.id].optionId); if (!o) throw new Error("Only listed options are allowed."); clean[q.id] = { optionId: o.id, label: `${q.text} -> ${o.label}` }; }
    spend(d);
    const plan = await mochiPlan(d.idea, clean);
    spend({ ...d, calls: d.calls + 1 });
    const research = await scoutResearch(d.idea, plan);
    await save(d.id, "status='researched', answers=?, plan=?, research=?, calls=calls+2", [JSON.stringify(clean), JSON.stringify(plan), JSON.stringify(research)]);
    return { ...d, status: "researched", answers: clean, plan, research, calls: d.calls + 2 };
  }
  if (d.status === "researched") {
    const f = d.research!.followups;
    const got = answers ?? {};
    if (f.some((q) => !got[q.id])) throw new Error("Only answered questions can go on: please answer every question.");
    const all: Answers = { ...d.answers };
    for (const q of f) { const o = q.options.find((x) => x.id === got[q.id].optionId); if (!o) throw new Error("Only listed options are allowed."); all[q.id] = { optionId: o.id, label: `${q.text} -> ${o.label}` }; }
    const sheet = buildSheet(d.idea, d.plan!, d.research!, all);
    await save(d.id, "status='ready', answers=?, sheet=?, skills=?", [JSON.stringify(all), sheet.text, JSON.stringify(sheet.skills)]);
    return { ...d, status: "ready", answers: all, sheet: sheet.text, skills: sheet.skills };
  }
  return d; // ready: nothing more to do
}

/** What the browser may see: never the raw sheet before it is ready. */
export const view = (d: Row) => ({
  id: d.id, idea: d.idea, status: d.status,
  questions: d.status === "asking" ? d.questions : [],
  followups: d.status === "researched" ? d.research!.followups : [],
  plan: d.plan, research: d.research ? { use: d.research.use, risks: d.research.risks, similar: d.research.similar, skills: d.research.skills } : null,
  ready: d.status === "ready", skills: d.skills, callsLeft: Math.max(0, MAX_CALLS - d.calls),
});
