import { z } from "zod";
import { keccak256, toBytes } from "viem";
import { db } from "@/db";
import { TermsSchema, hashTerms } from "./terms";
import { fundCalls, jobActionCalls, reviewCalls, type JobAction, type Call } from "./tx";

export const Act = z.discriminatedUnion("action", [
  z.object({ action: z.literal("fund") }),
  z.object({ action: z.literal("agree") }),
  z.object({ action: z.enum(["start", "cancel", "approveDelivery", "openSettlement", "poke"]) }),
  z.object({ action: z.enum(["postProgress", "deliver", "requestRevision"]), note: z.string().max(1000).default("") }),
  z.object({ action: z.enum(["offerSplit", "acceptSplit"]), toArtisan: z.number().int().min(0) }),
  z.object({ action: z.literal("review"), rating: z.number().int().min(1).max(5), body: z.string().max(1000).default("") }),
]);
export type ActInput = z.infer<typeof Act>;
export class ActError extends Error { constructor(public status: number, m: string) { super(m); } }

/** Same rules for people and agents: only the right party gets the call; the contract enforces it again. */
export async function buildJobCalls(j: Record<string, unknown>, wallet: string, a: ActInput): Promise<Call[]> {
  const isClient = String(j.client) === wallet, isArtisan = String(j.artisan) === wallet;
  if (!isClient && !isArtisan) throw new ActError(404, "Not found");
  const terms = TermsSchema.parse(JSON.parse(String(j.terms)));
  const cid = j.chain_job_id == null ? null : Number(j.chain_job_id);
  if (cid === null) throw new ActError(409, "Waiting for the agreement to be proposed onchain");
  const clientOnly = ["fund", "approveDelivery", "requestRevision"], artisanOnly = ["agree", "start", "postProgress", "deliver"];
  if (clientOnly.includes(a.action) && !isClient) throw new ActError(403, "Only the client can do this");
  if (artisanOnly.includes(a.action) && !isArtisan) throw new ActError(403, "Only the artisan can do this");
  const noteHash = (note: string) => keccak256(toBytes(`${cid}:${a.action}:${note}`));
  switch (a.action) {
    case "fund": return fundCalls(cid, terms);
    case "agree": return jobActionCalls(cid, { action: "agree", termsHash: hashTerms(terms) });
    case "postProgress": case "deliver": case "requestRevision": return jobActionCalls(cid, { action: a.action, hash: noteHash(a.note) } as JobAction);
    case "offerSplit": case "acceptSplit": return jobActionCalls(cid, { action: a.action, toArtisan: a.toArtisan });
    case "review": {
      const subject = (isClient ? terms.artisan : terms.client) as `0x${string}`;
      const rh = keccak256(toBytes(`${cid}:${wallet}:${a.rating}:${a.body}`));
      await db().execute({ sql: "UPDATE reviews SET body=? WHERE job_chain_id=? AND reviewer=?", args: [a.body, cid, wallet] });
      return reviewCalls(cid, subject, a.rating, rh);
    }
    default: return jobActionCalls(cid, { action: a.action });
  }
}
