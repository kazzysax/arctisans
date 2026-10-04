import { z } from "zod";
import { getAddress, isAddress, keccak256, toBytes } from "viem";
import { MAX_JOB, MIN_JOB } from "./money";

const addr = z.string().refine(isAddress, "bad address").transform((a) => getAddress(a));

/** The agreement both sides accept BEFORE anything is funded. Judged against, never opinions. */
export const TermsSchema = z
  .object({
    version: z.literal(1),
    client: addr,
    artisan: addr,
    title: z.string().min(3).max(120),
    description: z.string().max(2000).default(""),
    deliverables: z.array(z.string().min(1).max(200)).min(1).max(10),
    doneMeans: z.string().min(3).max(500), // "what counts as done"
    skills: z.array(z.string().min(1).max(30)).max(5).default([]),
    revisions: z.number().int().min(0).max(5),
    deadline: z.number().int().positive(), // unix seconds
    upfront: z.number().int().min(0), // micro-USDC released when the artisan starts
    milestones: z.array(z.number().int().positive()).min(1).max(10), // released on each approval
    deadlockRule: z.enum(["Split5050", "ToClient", "ToArtisan"]).default("Split5050"),
  })
  .superRefine((t, ctx) => {
    if (t.client === t.artisan) ctx.addIssue({ code: "custom", message: "client and artisan must differ" });
    const total = t.upfront + t.milestones.reduce((a, b) => a + b, 0);
    if (total < MIN_JOB) ctx.addIssue({ code: "custom", message: "minimum job is $0.10" });
    if (total > MAX_JOB) ctx.addIssue({ code: "custom", message: "maximum job is $100" });
  });
export type Terms = z.infer<typeof TermsSchema>;

export const DEADLOCK_CODE = { Split5050: 0, ToClient: 1, ToArtisan: 2 } as const;

export function totalOf(t: Pick<Terms, "upfront" | "milestones">): number {
  return t.upfront + t.milestones.reduce((a, b) => a + b, 0);
}

/** Sorted-key JSON so every client/server computes the identical hash. */
export function canonicalize(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonicalize).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalize(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}
export function hashTerms(t: Terms): `0x${string}` {
  return keccak256(toBytes(canonicalize(t)));
}

/** Upfront is earned, not default. Mirrors ArctisanEscrow.upfrontCapBps (the contract is the source of truth). */
export type Level = { level: 1 | 2 | 3; name: "New" | "Trusted" | "Pro"; upfrontBps: 0 | 3000 | 5000 };
export const LEVELS: Record<1 | 2 | 3, Level> = {
  1: { level: 1, name: "New", upfrontBps: 0 },
  2: { level: 2, name: "Trusted", upfrontBps: 3000 },
  3: { level: 3, name: "Pro", upfrontBps: 5000 },
};
export type OnchainRecord = { completed: number; uniqueClients: number; abandoned: number; verified: boolean };
export function levelOf(r: OnchainRecord): Level {
  if (!r.verified || r.abandoned > 0) return LEVELS[1];
  if (r.completed >= 20 && r.uniqueClients >= 10) return LEVELS[3];
  if (r.completed >= 5 && r.uniqueClients >= 3) return LEVELS[2];
  return LEVELS[1];
}
export function maxUpfront(total: number, capBps: number): number {
  return Math.floor((total * capBps) / 10_000);
}

/** Default money plan: everything on approval. If the artisan's level allows it, the requested upfront share
 *  (clamped to the level's cap) is released on start. */
export function defaultSplit(total: number, capBps = 0, wantBps = capBps): { upfront: number; milestones: number[] } {
  const upfront = maxUpfront(total, Math.min(capBps, wantBps));
  return { upfront, milestones: [total - upfront] };
}
