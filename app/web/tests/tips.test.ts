import { describe, it, expect } from "vitest";
import { tipCalls } from "../src/lib/tx";
import { MIN_TIP } from "../src/lib/money";
import { decodeFunctionData } from "viem";
import { erc20Abi } from "../src/lib/abi_ext";
import { arctisanSocialAbi } from "../src/lib/abi";

process.env.SOCIAL_ADDRESS = "0x20b1c93C620BdEAeAcCdBf113d95c774574dC7F5";
const to = "0x1111111111111111111111111111111111111111" as const;
const h = ("0x" + "ab".repeat(32)) as `0x${string}`;
describe("tips", () => {
  it("minimum is $0.10", () => { expect(MIN_TIP).toBe(100_000); expect(() => tipCalls(to, 99_999, h)).toThrow(); });
  it("$0.10 goes as ONE plain USDC transfer straight to the person", () => {
    const c = tipCalls(to, 100_000, h); expect(c).toHaveLength(1);
    const d = decodeFunctionData({ abi: erc20Abi, data: c[0].data }); expect(d.functionName).toBe("transfer"); expect(d.args).toEqual([to, 100_000n]);
  });
  it("$0.49 is still a plain transfer; $0.50 and up use the contract (approve + tip)", () => {
    expect(tipCalls(to, 499_999, h)).toHaveLength(1);
    const c = tipCalls(to, 500_000, h); expect(c).toHaveLength(2);
    expect(decodeFunctionData({ abi: arctisanSocialAbi, data: c[1].data }).functionName).toBe("tip");
  });
});
