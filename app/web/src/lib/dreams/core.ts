import { z } from "zod";

/** Arcdreams: the three dogs ask questions, research, and compile one Dream Sheet for the user's own Arc Studio. */

export const DOGS = {
  mochi: { name: "Mochi", role: "Planner", blurb: "Sniffs out the look, the people and the money rules." },
  scout: { name: "Scout", role: "Researcher", blurb: "Digs through what already exists on Arc." },
  bolt: { name: "Bolt", role: "Builder", blurb: "Packs it all up and sends it to Studio." },
} as const;

export const IDEA_MAX = 280;
export const ENTRY_MICRO = 1_000_000; // $1.00 in USDC (6 decimals)
export const MAX_CALLS = 8;           // hard cap on model calls per dream

/** Studio skills that are safe for a testnet build (uniswap is Arc-mainnet only, so it is left out). */
export const SKILLS = ["agent-standards", "chainlink", "circle-agent-wallet", "ens", "morpho", "polymarket", "pyth"] as const;

/** Models run long. Over-long text is trimmed (not rejected); structure and counts are still checked strictly. */
const noEmoji = (s: string) => s.replace(/[\p{Extended_Pictographic}\u200d\ufe0f]/gu, "").replace(/\s{2,}/g, " ").trim();
const clip = (n: number) => z.string().transform(noEmoji).pipe(z.string().min(1)).transform((s) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s));
/** Ids are made safe and short, so a sloppy model id still works and stays consistent in what we store. */
const slug = z.string().trim().min(1).transform((s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "x");
export const Option = z.object({ id: slug, label: clip(100) });
export const Question = z.object({
  id: slug,
  text: clip(140),
  options: z.array(Option).min(2).max(4).refine((o) => new Set(o.map((x) => x.id)).size === o.length, "duplicate option ids"),
});
export type Question = z.infer<typeof Question>;
export const QuestionSet = z.object({ questions: z.array(Question).min(3).max(5) });

export const PlanCard = z.object({
  name: clip(40),
  oneLiner: clip(140),
  vibe: clip(200),
  audience: clip(160),
  screens: z.array(clip(80)).min(2).max(6),
  rules: z.array(clip(140)).min(2).max(6),
  mustNot: z.array(clip(120)).max(4).default([]),
});
export type PlanCard = z.infer<typeof PlanCard>;

export const ResearchCard = z.object({
  use: z.array(z.object({ piece: clip(60), why: clip(140) })).min(1).max(6),
  skills: z.array(z.enum(SKILLS)).max(4).default([]),
  risks: z.array(clip(140)).min(1).max(5),
  similar: z.array(clip(100)).max(3).default([]),
  followups: z.array(Question).min(1).max(2),
});
export type ResearchCard = z.infer<typeof ResearchCard>;

export type Answers = Record<string, { optionId?: string; label: string }>;

/** What Scout is allowed to know about Arc. Short, sourced from docs.arc.io and the Arc Studio CLI guide. */
export const ARC_BRIEF = [
  "Arc is an EVM chain where USDC is the gas token, with finality in under a second. Native USDC uses 18 decimals, the ERC-20 interface uses 6.",
  "Circle pieces: User-Controlled and Developer-Controlled Wallets, Gas Station (gasless), CCTP and Bridge Kit (move USDC across chains), Gateway (unified balance), Onramp Kit, Swap Kit, Earn Kit, Borrow Kit.",
  "Agent standards on Arc: ERC-8004 (agent identity and reputation), ERC-8183 (jobs with escrow, delivery and settlement), x402 and nanopayments (agents pay per request).",
  "USDC is a stable dollar token worth $1. Gas on Arc is paid in USDC, so fees are predictable, never volatile.",
  "Arc Studio builds and deploys to testnets only, never mainnet. Its sandbox is a Vite app with Foundry contracts.",
].join("\n");

/** Pull the first JSON object out of a model reply, tolerating code fences and chatter. */
export function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "");
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no json");
  return JSON.parse(t.slice(a, b + 1));
}

/** Keeps the user's text from steering the dogs: strips control characters and collapses whitespace. */
/** Ideas Arcdreams will not plan: Studio's terms ban illegal or fraudulent apps, and we won't charge $1 for them. */
export const BLOCKED = /\b(phishing|ponzi|pyramid scheme|rug ?pull|honeypot|drain(er|ing)? (wallets?|funds)|steal(ing)? (funds|crypto|wallets?|keys?)|launder(ing)?|mixer|tumbler|fake (airdrop|token|exchange)|scam|counterfeit|child|sextort)/i;
export const cleanIdea = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, IDEA_MAX);

export const SHEET_MAX = 9_000; // Studio hard-caps a prompt at 10,000 characters
const list = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");

/** Bolt's Dream Sheet. Deterministic, so its size is bounded by the card limits above. */
export function buildSheet(idea: string, plan: PlanCard, research: ResearchCard, answers: Answers): { text: string; skills: string[] } {
  const picked = Object.values(answers).map((a) => a.label);
  const text = [
    `# ${plan.name}: Dream Sheet`,
    `Built from an Arcdreams brief. Treat this brief as the full spec. Ask me only if something below is truly missing.`,
    ``,
    `## The idea`,
    `${idea}`,
    `${plan.oneLiner}`,
    ``,
    `## Who it is for`,
    plan.audience,
    ``,
    `## Look and feel`,
    plan.vibe,
    ``,
    `## Screens`,
    list(plan.screens),
    ``,
    `## Rules the contract must hold`,
    list(plan.rules),
    plan.mustNot.length ? `\n## Must never happen\n${list(plan.mustNot)}` : ``,
    ``,
    `## Use these Arc and Circle pieces`,
    list(research.use.map((u) => `${u.piece}: ${u.why}`)),
    research.risks.length ? `\n## Risks to design around\n${list(research.risks)}` : ``,
    research.similar.length ? `\n## Similar apps (do something different)\n${list(research.similar)}` : ``,
    ``,
    `## What the user chose`,
    list(picked),
    ``,
    `## Build order (one turn each)`,
    `1. Write the smart contract for the rules above, run the review, fix findings, then deploy to Arc testnet.`,
    `2. Build the app on top of the deployed contract, with every screen above, wired to real reads and writes.`,
    `3. Polish: empty states, error messages, loading states, and mobile layout.`,
    ``,
    `## Constraints`,
    `- Arc testnet only. USDC is the gas token; native USDC has 18 decimals, the ERC-20 interface has 6.`,
    `- No placeholder text or fake data. Keep it small and clean.`,
  ].filter((l) => l !== undefined).join("\n");
  return { text: text.slice(0, SHEET_MAX), skills: [...research.skills] };
}

/** Studio sometimes asks a question inside plain text with status "completed". Detect that so a build never looks done while it waits. */
export function looksLikeQuestion(finalText: string, filesChanged: number, deployments: number): boolean {
  if (filesChanged > 0 || deployments > 0) return false;
  const t = finalText.trim();
  return t.length > 0 && (/\?\s*$/.test(t) || /\b(which|should i|do you want|let me know|please confirm|can you clarify)\b/i.test(t.slice(-400)));
}
