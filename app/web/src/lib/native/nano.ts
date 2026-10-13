import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { GatewayClient, CHAIN_CONFIGS } from "@circle-fin/x402-batching/client";
import { db } from "@/db";
import { NANO_PRICE } from "./agents";

/**
 * Agent-to-agent payments through Circle Nanopayments (x402 on Gateway). Any native agent can sell its work at /api/native/hire/<handle>;
 * a buying agent pays a few cents as a signed, gasless authorization, then gets the work back in the same call. Replaces the escrow sub-hire
 * for these tiny machine-to-machine jobs. If anything fails the worker falls back to the escrow sub-hire.
 */
const NET = () => (process.env.DREAMS_NET === "arcTestnet" ? "arcTestnet" : "arc") as "arc" | "arcTestnet";
const CAIP = () => (NET() === "arc" ? "eip155:5042" : "eip155:5042002");
const GATEWAY = () => (NET() === "arc" ? "https://gateway-api.circle.com" : "https://gateway-api-testnet.circle.com");
export const nativeNanoOn = () => process.env.NATIVE_NANO === "1";
export const originUrl = () => process.env.APP_ORIGIN ?? "https://arctisans.vercel.app";

export function requirementsFor(payTo: string, micro: number) {
  const cfg = CHAIN_CONFIGS[NET()];
  return { scheme: "exact", network: CAIP(), asset: cfg.usdc, amount: String(micro), maxTimeoutSeconds: 604_900, payTo,
    extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: cfg.gatewayWallet } };
}

/** Seller side. A Response means "stop here" (402 or a refusal); null means the payment settled. */
export async function takePayment(req: Request, handle: string, payTo: string): Promise<{ payer: string; tx: string } | Response> {
  const micro = NANO_PRICE[handle];
  if (!micro) return Response.json({ error: "Unknown agent" }, { status: 404 });
  const reqs = requirementsFor(payTo, micro);
  const sig = req.headers.get("payment-signature");
  if (!sig) {
    const body = { x402Version: 2, resource: { url: new URL(req.url).pathname, description: `${handle} work`, mimeType: "application/json" }, accepts: [reqs] };
    return new Response("{}", { status: 402, headers: { "content-type": "application/json", "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(body)).toString("base64") } });
  }
  try {
    const payload = JSON.parse(Buffer.from(sig, "base64").toString("utf8"));
    const r = await new BatchFacilitatorClient({ url: GATEWAY() }).settle(payload, reqs as never) as { success: boolean; transaction?: string; payer?: string; errorReason?: string };
    if (!r.success) return Response.json({ error: `Payment rejected: ${r.errorReason ?? "unknown"}` }, { status: 402 });
    return { payer: r.payer ?? "", tx: r.transaction ?? "" };
  } catch (e) { return Response.json({ error: `Payment could not be checked: ${(e as Error).message.slice(0, 120)}` }, { status: 402 }); }
}

/** Buyer side: one agent pays another and returns the work. Remembered per (job, helper), so a retried job never pays twice. */
export async function nanoHire(buyerKey: `0x${string}`, buyer: string, helper: string, jobId: string, ask: string): Promise<{ text: string; tx: string | null; micro: number; fresh: boolean }> {
  const prior = await db().execute({ sql: "SELECT result, tx, amount_micro FROM native_nano WHERE job_id=? AND to_handle=?", args: [jobId, helper] });
  if (prior.rows[0]) return { text: String(prior.rows[0].result), tx: prior.rows[0].tx ? String(prior.rows[0].tx) : null, micro: Number(prior.rows[0].amount_micro), fresh: false };
  const client = new GatewayClient({ chain: NET(), privateKey: buyerKey });
  const r = await client.pay(`${originUrl()}/api/native/hire/${helper}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ask }) });
  const text = String((r.data as { text?: string } | undefined)?.text ?? "");
  if (!text) throw new Error("the agent was paid but returned nothing");
  const tx = r.transaction || null, micro = NANO_PRICE[helper];
  await db().execute({ sql: "INSERT OR IGNORE INTO native_nano(id,job_id,from_handle,to_handle,amount_micro,result,tx,network,created_at) VALUES(?,?,?,?,?,?,?,?,?)", args: [crypto.randomUUID(), jobId, buyer, helper, micro, text, tx, CAIP(), Date.now()] });
  return { text, tx, micro, fresh: true };
}
