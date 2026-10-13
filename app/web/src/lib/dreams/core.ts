import { z } from "zod";

/** Arcdreams: Mochi interviews like a product lead, Scout researches the whole project, Bolt compiles one Dream Sheet for the user's own Arc Studio. */

export const DOGS = {
  mochi: { name: "Mochi", role: "Planner" },
  scout: { name: "Scout", role: "Researcher" },
  bolt: { name: "Bolt", role: "Builder" },
} as const;

export const IDEA_MAX = 280;
export const NOTES_MAX = 300;
export const ENTRY_MICRO = 1_000_000; // $1.00 in USDC (6 decimals)
export const MAX_CALLS = 8;           // hard cap on model calls per dream

/** Studio skills that are safe for a testnet build (uniswap is Arc-mainnet only, so it is left out). */
export const SKILLS = ["agent-standards", "chainlink", "circle-agent-wallet", "ens", "morpho", "polymarket", "pyth"] as const;

/** Models run long. Over-long text is trimmed (not rejected); structure and counts are still checked strictly. */
const noEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "").replace(/\s{2,}/g, " ").trim();
/** Models sometimes send {"role":"x","can":"y"} where a sentence is expected: join its text values rather than reject. */
const text = z.preprocess((v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.values(v).filter((x) => typeof x === "string").join(": ") : Array.isArray(v) ? v.filter((x) => typeof x === "string").join("; ") : v), z.string());
const clip = (n: number) => text.transform(noEmoji).pipe(z.string().min(1)).transform((s) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s));
/** Ids are made safe and short, so a sloppy model id still works and stays consistent in what we store. */
const slug = z.string().trim().min(1).transform((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "x");
/** A list that keeps its first n items when the model sends more (lists run long; a long list is not an error). */
const top = <T extends z.ZodTypeAny>(item: T, min: number, max: number) => z.preprocess((v) => (Array.isArray(v) ? v.slice(0, max) : v), z.array(item).min(min).max(max));
const SECTION = z.string().transform((s) => s.trim().toLowerCase()).pipe(z.enum(["specs", "features", "design"]));

export const Option = z.object({ id: slug, label: clip(100) });
export const Question = z.object({
  id: slug,
  section: SECTION.default("specs"),
  text: clip(150),
  multi: z.boolean().default(false),
  options: top(Option, 2, 6).refine((o) => new Set(o.map((x) => x.id)).size === o.length, "duplicate option ids"),
});
export type Question = z.infer<typeof Question>;
/** Mochi's interview: a real project intake, 9 questions across Specs, Features and Design. Scout's follow-ups reuse the same shape. */
export const QuestionSet = z.object({ questions: top(Question, 6, 10) }).refine((q) => new Set(q.questions.map((x) => x.id)).size === q.questions.length, "duplicate question ids");

export const PlanCard = z.object({
  name: clip(40),
  oneLiner: clip(140),
  audience: clip(160),
  roles: top(clip(90), 1, 4),
  mustHave: top(clip(100), 3, 7),
  later: top(clip(80), 0, 4).default([]),
  acceptance: top(clip(130), 3, 6),
  vibe: clip(200),
  screens: top(clip(80), 2, 6),
  rules: top(clip(140), 2, 6),
  mustNot: top(clip(110), 0, 4).default([]),
});
export type PlanCard = z.infer<typeof PlanCard>;

export const ResearchCard = z.object({
  stack: top(z.object({ layer: clip(30), choice: clip(60), why: clip(200) }), 3, 7),
  architecture: clip(600),
  dataModel: top(clip(180), 2, 6),
  integrations: top(z.object({ name: clip(50), why: clip(180) }), 0, 5).default([]),
  arcPieces: top(z.object({ piece: clip(50), why: clip(180) }), 0, 5).default([]),
  studioCovers: top(clip(140), 1, 5),
  outsideStudio: top(clip(160), 0, 5).default([]),
  milestones: top(clip(170).transform((m) => m.replace(/^\s*(?:step\s*)?\d+[.):-]\s*/i, "")), 3, 6),
  risks: top(clip(170), 2, 5),
  similar: top(z.object({ name: clip(40), lesson: clip(170) }), 0, 4).default([]),
  skills: z.preprocess((v) => (Array.isArray(v) ? v.filter((x) => (SKILLS as readonly string[]).includes(x)).slice(0, 4) : []), z.array(z.enum(SKILLS))).default([]),
  followups: top(Question, 1, 3),
  sources: z.preprocess((v) => (Array.isArray(v) ? v.filter((u) => typeof u === "string" && /^https?:\/\/[^\s]+$/.test(u)).slice(0, 6) : []), z.array(z.string())).default([]),
});
export type ResearchCard = z.infer<typeof ResearchCard>;

/** One answer: the options picked (one for single-choice) and the text we show and feed onward. */
export type Answers = Record<string, { optionIds: string[]; label: string }>;

/** What the dogs know about Arc. Short, from docs.arc.io and the Arc Studio CLI guide. Scout may go far beyond it. */
export const ARC_BRIEF = [
  "Arc is an EVM chain where USDC is the gas token, with finality in under a second. Native USDC uses 18 decimals, the ERC-20 interface uses 6.",
  "Circle pieces: User-Controlled and Developer-Controlled Wallets, Gas Station (gasless), CCTP and Bridge Kit (move USDC across chains), Gateway (unified balance), Onramp Kit, Swap Kit, Earn Kit, Borrow Kit.",
  "Agent standards on Arc: ERC-8004 (agent identity and reputation), ERC-8183 (jobs with escrow, delivery and settlement), x402 and nanopayments (agents pay per request).",
  "USDC is a stable dollar token worth $1. Gas on Arc is paid in USDC, so fees are predictable, never volatile.",
  "Arc Studio builds and deploys to testnets only, never mainnet. Its sandbox is a Vite app with Foundry contracts. It has no hosting, and no backend server or database of its own.",
].join("\n");

/** Pull the first JSON object out of a model reply, tolerating code fences and chatter. */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no json");
  return JSON.parse(t.slice(a, b + 1));
}

/** Ideas Arcdreams will not plan: Studio's terms ban illegal or fraudulent apps, and we won't charge $1 for them. */
export const BLOCKED = /\b(phishing|ponzi|pyramid scheme|rug ?pull|honeypot|drain(er|ing)? (wallets?|funds)|steal(ing)? (funds|crypto|wallets?|keys?)|launder(ing)?|mixer|tumbler|fake (airdrop|token|exchange)|scam|counterfeit|child|sextort)/i;
/** Keeps the user's text from steering the dogs: strips control characters and collapses whitespace. */
export const cleanIdea = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, IDEA_MAX);
export const cleanNotes = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, NOTES_MAX);

export const SHEET_MAX = 9_000; // Studio hard-caps a prompt at 10,000 characters
const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
const sec = (title: string, body: string) => (body.trim() ? `\n## ${title}\n${body}` : "");

/** Bolt's Dream Sheet. Deterministic, so its size is bounded by the card limits above. Only what Studio can build goes in; the rest stays in the user's report. */
export function buildSheet(idea: string, plan: PlanCard, r: ResearchCard, answers: Answers): { text: string; skills: string[] } {
  const picked = Object.values(answers).map((a) => a.label);
  const text = [
    `# ${plan.name}: Dream Sheet`,
    `Built from an Arcdreams brief. Treat this as the full spec. Ask me only if something below is truly missing.`,
    sec("The idea", `${idea}\n${plan.oneLiner}`),
    sec("Users and roles", `${plan.audience}\n${list(plan.roles)}`),
    sec("Must-have features", list(plan.mustHave)),
    sec("Later, do not build now", list(plan.later)),
    sec("Acceptance criteria (the app is done when all hold)", list(plan.acceptance)),
    sec("Look and feel", plan.vibe),
    sec("Screens", list(plan.screens)),
    sec("Rules the contract must hold", list(plan.rules)),
    sec("Must never happen", list(plan.mustNot)),
    sec("Architecture", `${r.architecture}\nData the contract and app keep:\n${list(r.dataModel)}`),
    sec("Use these Arc and Circle pieces", list(r.arcPieces.map((u) => `${u.piece}: ${u.why}`))),
    sec("What to build in Studio", list(r.studioCovers)),
    sec("Build order (one turn each)", [
      ...r.milestones.map((m, i) => `${i + 1}. ${m}`),
      `Contract first: write it, run the review, fix findings, deploy to Arc testnet. Then the app on the deployed contract, then polish.`,
    ].join("\n")),
    sec("Risks to design around", list(r.risks)),
    sec("Choices the user made", list(picked)),
    sec("Constraints", [
      `- Arc testnet only. USDC is the gas token; native USDC has 18 decimals, the ERC-20 interface has 6.`,
      `- No placeholder text or fake data. Keep it small, clean and mobile-first.`,
    ].join("\n")),
  ].join("\n");
  return { text: text.slice(0, SHEET_MAX), skills: [...r.skills] };
}

/** Studio sometimes asks a question inside plain text with status "completed". Detect that so a build never looks done while it waits. */
export function looksLikeQuestion(finalText: string, filesChanged: number, deployments: number): boolean {
  if (filesChanged > 0 || deployments > 0) return false;
  const t = finalText.trim();
  return t.length > 0 && (/\?\s*$/.test(t) || /\b(which|should i|do you want|let me know|please confirm|can you clarify)\b/i.test(t.slice(-400)));
}

/** Checks one answered question against what was asked. Single-choice takes exactly one option; multi takes one or more. Returns the saved answer or an error. */
export function checkAnswer(q: Question, picked: string[] | undefined): { ok: true; a: Answers[string] } | { ok: false; error: string } {
  const ids = [...new Set(picked ?? [])];
  if (!ids.length) return { ok: false, error: "Only answered questions can go on: please answer every question." };
  if (!q.multi && ids.length !== 1) return { ok: false, error: "Only one option is allowed for that question." };
  const chosen = ids.map((i) => q.options.find((o) => o.id === i));
  if (chosen.some((c) => !c)) return { ok: false, error: "Only listed options are allowed." };
  return { ok: true, a: { optionIds: ids, label: `${q.text} -> ${chosen.map((c) => c!.label).join("; ")}` } };
}
