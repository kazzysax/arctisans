import { createPublicClient, http, erc20Abi } from "viem";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { arc, USDC } from "@/lib/chain";

/** The signed-in user's USDC balance on Arc (6 decimals) and their wallet address, read straight from the chain. */
export const GET = route("wallet-balance", 120, async (req) => {
  const { wallet } = requireSession(req);
  const c = createPublicClient({ chain: arc, transport: http(process.env.RPC_URL ?? arc.rpcUrls.default.http[0]) });
  const bal = await c.readContract({ address: USDC, abi: erc20Abi, functionName: "balanceOf", args: [wallet as `0x${string}`] });
  return ok({ wallet, balance: Number(bal) });
});
