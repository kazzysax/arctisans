import { privateKeyToAccount } from "viem/accounts";
import { BatchFacilitatorClient } from "@circle-fin/x402-batching/server";
import { GatewayClient, CHAIN_CONFIGS } from "@circle-fin/x402-batching/client";
import { db } from "@/db";

/**
 * Circle Nanopayments (x402 on Gateway). Each dog is a seller with its own wallet; the dog before it in the
 * chain is the buyer. A payment is a gasless signed authorization, settled in batches by Circle Gateway.
 * Failure never blocks a dream: the user already paid, so the work is done either way and the ledger says what happened.
 */
export type Dog = "mochi" | "scout" | "bolt";
export const PRICE: Record<"scout" | "bolt", { from: Dog; micro: number; why: string }> = {
  scout: { from: "mochi", micro: 30_000, why: "for the research" },
  bolt: { from: "scout", micro: 20_000, why: "for compiling the Dream Sheet" },
};

const NET = () => (process.env.DREAMS_NET === "arcTestnet" ? "arcTestnet" : "arc") as "arc" | "arcTestnet";
const CAIP = () => (NET() === "arc" ? "eip155:5042" : "eip155:5042002");
const GATEWAY = () => (NET() === "arc" ? "https://gateway-api.circle.com" : "https://gateway-api-testnet.circle.com");

type Keys = Record<Dog, { key: `0x${string}`; address: string }>;
/** DREAMS_DOG_KEYS is a JSON object {mochi:{key},scout:{key},bolt:{key}}. Without it nanopayments are simply off. */
export function dogs(): Keys | null {
  try {
    const j = JSON.parse(process.env.DREAMS_DOG_KEYS ?? "");
    const out = {} as Keys;
    for (const d of ["mochi", "scout", "bolt"] as Dog[]) {
      const k = j[d]?.key; if (!/^0x[0-9a-fA-F]{64}$/.test(k)) return null;
      out[d] = { key: k, address: privateKeyToAccount(k).address };
    }
    return out;
  } catch { return null; }
}
export const nanoOn = () => dogs() !== null;

function requirements(to: Dog, micro: number) {
  const cfg = CHAIN_CONFIGS[NET()];
  return {
    scheme: "exact", network: CAIP(), asset: cfg.usdc, amount: String(micro), maxTimeoutSeconds: 604_900, payTo: dogs()![to].address,
    extra: { name: "GatewayWalletBatched", version: "1", verifyingContract: cfg.gatewayWallet },
  };
}

/** Seller side. Returns null when the payment settled, or the 402 response to send back. */
export async function requirePayment(req: Request, to: "scout" | "bolt"): Promise<{ paid: true; payer: string; tx: string } | Response> {
  if (!nanoOn()) return Response.json({ error: "Nanopayments are not enabled" }, { status: 503 });
  const reqs = requirements(to, PRICE[to].micro);
  const sig = req.headers.get("payment-signature");
  if (!sig) {
    const body = { x402Version: 2, resource: { url: new URL(req.url).pathname, description: `${to} work`, mimeType: "application/json" }, accepts: [reqs] };
    return new Response("{}", { status: 402, headers: { "content-type": "application/json", "PAYMENT-REQUIRED": Buffer.from(JSON.stringify(body)).toString("base64") } });
  }
  try {
    const payload = JSON.parse(Buffer.from(sig, "base64").toString("utf8"));
    const r = await new BatchFacilitatorClient({ url: GATEWAY() }).settle(payload, reqs as never) as { success: boolean; transaction?: string; payer?: string; errorReason?: string };
    if (!r.success) return Response.json({ error: `Payment rejected: ${r.errorReason ?? "unknown"}` }, { status: 402 });
    return { paid: true, payer: r.payer ?? PRICE[to].from, tx: r.transaction ?? "" };
  } catch (e) { return Response.json({ error: `Payment could not be checked: ${(e as Error).message.slice(0, 120)}` }, { status: 402 }); }
}

export type Pay = { id: string; from: Dog; to: Dog; micro: number; status: "paid" | "failed"; tx: string | null; why: string };

async function record(dreamId: string, from: Dog, to: Dog, micro: number, status: "paid" | "failed", tx: string | null, error: string | null) {
  await db().execute({
    sql: "INSERT INTO dream_payments(id,dream_id,from_dog,to_dog,amount_micro,status,tx,error,network,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
    args: [crypto.randomUUID(), dreamId, from, to, micro, status, tx, error, CAIP(), Date.now()],
  });
}

/** Buyer side: the paying dog calls the other dog's paid endpoint. Throws if it could not pay or the work failed. */
export async function payDog(dreamId: string, to: "scout" | "bolt", url: string): Promise<void> {
  const k = dogs(); if (!k) throw new Error("off");
  const p = PRICE[to];
  const client = new GatewayClient({ chain: NET(), privateKey: k[p.from].key });
  try {
    const r = await client.pay(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dream: dreamId }) });
    await record(dreamId, p.from, to, p.micro, "paid", r.transaction || null, null);
  } catch (e) {
    await record(dreamId, p.from, to, p.micro, "failed", null, (e as Error).message.slice(0, 200));
    throw e;
  }
}

export async function payments(dreamId: string): Promise<Pay[]> {
  const r = await db().execute({ sql: "SELECT * FROM dream_payments WHERE dream_id=? ORDER BY created_at", args: [dreamId] });
  return r.rows.map((x) => ({ id: String(x.id), from: x.from_dog as Dog, to: x.to_dog as Dog, micro: Number(x.amount_micro), status: x.status as Pay["status"], tx: x.tx ? String(x.tx) : null, why: PRICE[x.to_dog as "scout" | "bolt"]?.why ?? "" }));
}
