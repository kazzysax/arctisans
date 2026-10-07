import { describe, it, expect, beforeAll } from "vitest";
import { decodeFunctionData } from "viem";
import { arctisanEscrowAbi, arctisanSocialAbi } from "@/lib/abi";
import { erc20Abi } from "@/lib/abi_ext";
import { fundCalls, tipCalls, jobActionCalls, reviewCalls, proposeCalls } from "@/lib/tx";
import { TermsSchema, hashTerms } from "@/lib/terms";
import { USDC } from "@/lib/chain";

const A = "0x00000000000000000000000000000000000000a1", C = "0x00000000000000000000000000000000000000c1";
const t = TermsSchema.parse({ version: 1, client: C, artisan: A, title: "Logo", deliverables: ["x"], doneMeans: "done done", revisions: 1, deadline: 2000000000, upfront: 10_000_000, milestones: [10_000_000] });

beforeAll(() => {
  process.env.ESCROW_ADDRESS = "0x00000000000000000000000000000000000000e5";
  process.env.SOCIAL_ADDRESS = "0x00000000000000000000000000000000000000f5";
});

describe("transaction builders", () => {
  it("fund = approve EXACT total then fund with the terms hash", () => {
    const [ap, fu] = fundCalls(7, t);
    expect(ap.to).toBe(USDC);
    const d1 = decodeFunctionData({ abi: erc20Abi, data: ap.data });
    expect(d1.args?.[1]).toBe(20_000_000n);
    const d2 = decodeFunctionData({ abi: arctisanEscrowAbi, data: fu.data });
    expect(d2.functionName).toBe("fund");
    expect(d2.args).toEqual([7n, hashTerms(t)]);
  });
  it("propose carries the hash, upfront and milestones", () => {
    const d = decodeFunctionData({ abi: arctisanEscrowAbi, data: proposeCalls(t)[0].data });
    expect(d.functionName).toBe("propose");
    expect(d.args?.[2]).toBe(hashTerms(t));
    expect(d.args?.[3]).toBe(10_000_000n);
  });
  it("tip approves exact amount to the social contract and enforces $0.10 min", () => {
    const [ap, tip] = tipCalls(A, 2_000_000, "0x" + "11".repeat(32) as `0x${string}`);
    expect((decodeFunctionData({ abi: erc20Abi, data: ap.data }).args as readonly unknown[])[1]).toBe(2_000_000n);
    expect(decodeFunctionData({ abi: arctisanSocialAbi, data: tip.data }).functionName).toBe("tip");
    expect(() => tipCalls(A, 99_999, "0x" + "11".repeat(32) as `0x${string}`)).toThrow();
  });
  it("job actions encode the right function", () => {
    for (const a of ["start", "cancel", "approveDelivery", "openSettlement", "poke"] as const) {
      expect(decodeFunctionData({ abi: arctisanEscrowAbi, data: jobActionCalls(3, { action: a })[0].data }).functionName).toBe(a);
    }
    expect(decodeFunctionData({ abi: arctisanEscrowAbi, data: jobActionCalls(3, { action: "offerSplit", toArtisan: 5 })[0].data }).functionName).toBe("offerSplit");
  });
  it("review validates rating", () => {
    expect(() => reviewCalls(1, A, 6, "0x" + "00".repeat(32) as `0x${string}`)).toThrow();
    expect(reviewCalls(1, A, 5, "0x" + "00".repeat(32) as `0x${string}`)).toHaveLength(1);
  });
});
