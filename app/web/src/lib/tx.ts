import { encodeFunctionData, type Hex } from "viem";
import { USDC } from "./chain";
import { arctisanEscrowAbi, arctisanSocialAbi } from "./abi";
import { erc20Abi } from "./abi_ext";
import { env } from "./env";
import { DEADLOCK_CODE, hashTerms, totalOf, type Terms } from "./terms";
import { MIN_TIP, CONTRACT_MIN_TIP } from "./money";

export type Call = { to: `0x${string}`; data: Hex; label: string };

const esc = (fn: string, args: unknown[]) =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  encodeFunctionData({ abi: arctisanEscrowAbi, functionName: fn as any, args: args as any });

/** Client or artisan proposes the agreement on-chain. */
export function proposeCalls(t: Terms): Call[] {
  return [
    {
      to: env.escrow(),
      label: "Propose agreement",
      data: esc("propose", [t.client, t.artisan, hashTerms(t), BigInt(t.upfront), t.milestones.map(BigInt), BigInt(t.deadline), t.revisions, DEADLOCK_CODE[t.deadlockRule]]),
    },
  ];
}

/** One confirmation: approve the exact amount, then fund. */
export function fundCalls(chainJobId: number, t: Terms): Call[] {
  const total = BigInt(totalOf(t));
  return [
    { to: USDC, label: "Approve exact amount", data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [env.escrow(), total] }) },
    { to: env.escrow(), label: "Fund escrow", data: esc("fund", [BigInt(chainJobId), hashTerms(t)]) },
  ];
}

export type JobAction =
  | { action: "agree"; termsHash: Hex }
  | { action: "start" | "cancel" | "approveDelivery" | "openSettlement" | "poke" }
  | { action: "postProgress" | "deliver" | "requestRevision"; hash: Hex }
  | { action: "offerSplit" | "acceptSplit"; toArtisan: number };

export function jobActionCalls(chainJobId: number, a: JobAction): Call[] {
  const id = BigInt(chainJobId);
  const one = (label: string, data: Hex): Call[] => [{ to: env.escrow(), label, data }];
  switch (a.action) {
    case "agree": return one("Accept terms", esc("agree", [id, a.termsHash]));
    case "start": return one("Start work", esc("start", [id]));
    case "cancel": return one("Cancel", esc("cancel", [id]));
    case "approveDelivery": return one("Approve delivery", esc("approveDelivery", [id]));
    case "openSettlement": return one("Open settlement", esc("openSettlement", [id]));
    case "poke": return one("Apply timer", esc("poke", [id]));
    case "postProgress": return one("Post progress", esc("postProgress", [id, a.hash]));
    case "deliver": return one("Deliver", esc("deliver", [id, a.hash]));
    case "requestRevision": return one("Request revision", esc("requestRevision", [id, a.hash]));
    case "offerSplit": return one("Offer split", esc("offerSplit", [id, BigInt(a.toArtisan)]));
    case "acceptSplit": return one("Accept split", esc("acceptSplit", [id, BigInt(a.toArtisan)]));
  }
}

export function tipCalls(to: `0x${string}`, amount: number, postHash: Hex): Call[] {
  if (!Number.isInteger(amount) || amount < MIN_TIP) throw new Error("Minimum tip is $0.10");
  // The Social contract refuses under $0.50. Smaller tips are one plain USDC transfer, straight to them; the server records it from the receipt.
  if (amount < CONTRACT_MIN_TIP) return [{ to: USDC, label: "Send tip", data: encodeFunctionData({ abi: erc20Abi, functionName: "transfer", args: [to, BigInt(amount)] }) }];
  return [
    { to: USDC, label: "Approve tip", data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [env.social(), BigInt(amount)] }) },
    { to: env.social(), label: "Send tip", data: encodeFunctionData({ abi: arctisanSocialAbi, functionName: "tip", args: [to, BigInt(amount), postHash] }) },
  ];
}

export function reviewCalls(chainJobId: number, subject: `0x${string}`, rating: number, reviewHash: Hex): Call[] {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error("Rating 1-5");
  return [{ to: env.social(), label: "Post review", data: encodeFunctionData({ abi: arctisanSocialAbi, functionName: "review", args: [BigInt(chainJobId), subject, rating, reviewHash] }) }];
}

export function profileCalls(cid: string, isAgent: boolean, owner: `0x${string}`): Call[] {
  return [{ to: env.social(), label: "Save profile", data: encodeFunctionData({ abi: arctisanSocialAbi, functionName: "setProfile", args: [cid, isAgent, owner] }) }];
}
export function publishCalls(postHash: Hex, cid: string): Call[] {
  return [{ to: env.social(), label: "Publish post", data: encodeFunctionData({ abi: arctisanSocialAbi, functionName: "publish", args: [postHash, cid] }) }];
}
