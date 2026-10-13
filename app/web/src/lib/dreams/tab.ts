import { createWalletClient, encodeFunctionData, http, keccak256, parseEventLogs, stringToHex, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arc, USDC } from "@/lib/chain";
import { client } from "@/lib/indexer";
import { erc20Abi } from "@/lib/abi_ext";

/**
 * The Arcdreams tab: the user deposits $1 into the DreamTab contract. Before each step the server charges that step's cost; the user can withdraw
 * the rest any time. The contract caps charges at $0.40 per dream, so even a leaked operator key cannot touch a deposit beyond that.
 */
export const tabAbi = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "id", type: "bytes32" }, { name: "amount", type: "uint96" }], outputs: [] },
  { type: "function", name: "charge", stateMutability: "nonpayable", inputs: [{ name: "id", type: "bytes32" }, { name: "step", type: "bytes32" }, { name: "amount", type: "uint96" }], outputs: [] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "id", type: "bytes32" }], outputs: [] },
  { type: "function", name: "tabs", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }], outputs: [{ name: "owner", type: "address" }, { name: "deposited", type: "uint96" }, { name: "charged", type: "uint96" }, { name: "withdrawn", type: "uint96" }] },
  { type: "function", name: "stepCharged", stateMutability: "view", inputs: [{ name: "", type: "bytes32" }, { name: "", type: "bytes32" }], outputs: [{ name: "", type: "bool" }] },
  { type: "event", name: "Deposited", inputs: [{ name: "id", type: "bytes32", indexed: true }, { name: "owner", type: "address", indexed: true }, { name: "amount", type: "uint96", indexed: false }] },
] as const;

/** What each step costs the user. Fixed prices, set above what the model, search and dog payments really cost. All four add up to $0.25, under the $0.40 on-chain cap. */
export const STEP_COST = { questions: 30_000, plan: 40_000, research: 150_000, compile: 30_000 } as const;
export type Step = keyof typeof STEP_COST;
export const TAB_TOTAL = Object.values(STEP_COST).reduce((a, b) => a + b, 0);

export const tabAddress = () => (process.env.DREAMS_TAB ?? "") as `0x${string}`;
export const tabOn = () => /^0x[0-9a-fA-F]{40}$/.test(tabAddress()) && /^0x[0-9a-fA-F]{64}$/.test(process.env.DREAMS_OPERATOR_KEY ?? "");

export const tabId = (dreamId: string): Hex => keccak256(stringToHex(`arcdreams:${dreamId}`));
const stepId = (s: Step): Hex => toHex(s, { size: 32 });

export function depositCalls(dreamId: string, micro: number) {
  return [
    { to: USDC, label: "Approve the $1 deposit", data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [tabAddress(), BigInt(micro)] }) },
    { to: tabAddress(), label: "Open your tab ($1, withdraw what is left)", data: encodeFunctionData({ abi: tabAbi, functionName: "deposit", args: [tabId(dreamId), BigInt(micro)] }) },
  ];
}
export const withdrawCall = (dreamId: string) => ({ to: tabAddress(), label: "Withdraw what is left", data: encodeFunctionData({ abi: tabAbi, functionName: "withdraw", args: [tabId(dreamId)] }) });

/** True if this receipt opened a tab for this dream, from this wallet, with at least `micro`. */
export async function verifyDeposit(hash: Hex, wallet: string, dreamId: string, micro: number): Promise<boolean> {
  const rcpt = await client().getTransactionReceipt({ hash }).catch(() => null);
  if (!rcpt || rcpt.status !== "success") return false;
  const logs = parseEventLogs({ abi: tabAbi, eventName: "Deposited", logs: rcpt.logs.filter((l) => l.address.toLowerCase() === tabAddress().toLowerCase()) });
  return logs.some((l) => l.args.id === tabId(dreamId) && l.args.owner.toLowerCase() === wallet.toLowerCase() && Number(l.args.amount) >= micro);
}

export type TabView = { deposited: number; spent: number; withdrawn: number; left: number };
export async function readTab(dreamId: string): Promise<TabView | null> {
  const t = await client().readContract({ address: tabAddress(), abi: tabAbi, functionName: "tabs", args: [tabId(dreamId)] }).catch(() => null);
  if (!t || /^0x0+$/.test(t[0])) return null;
  const [, d, c, w] = t.map(Number) as [number, number, number, number];
  return { deposited: d, spent: c, withdrawn: w, left: d - c - w };
}

export class TabError extends Error { constructor(public code: "empty" | "chain", msg: string) { super(msg); } }

/** Takes this step's cost from the user's tab, BEFORE the work runs. Already charged = fine (a retry). Throws TabError if the tab can't pay. */
export async function chargeStep(dreamId: string, step: Step): Promise<void> {
  const id = tabId(dreamId), sid = stepId(step), pub = client();
  const done = await pub.readContract({ address: tabAddress(), abi: tabAbi, functionName: "stepCharged", args: [id, sid] }).catch(() => null);
  if (done === true) return;
  const t = await readTab(dreamId);
  if (!t) throw new TabError("chain", "Your tab could not be read. Try again in a moment.");
  if (t.left < STEP_COST[step]) throw new TabError("empty", "Your tab has been withdrawn or is used up, so the dogs can't take this step.");
  try {
    const w = createWalletClient({ account: privateKeyToAccount(process.env.DREAMS_OPERATOR_KEY as Hex), chain: arc, transport: http(process.env.RPC_URL ?? arc.rpcUrls.default.http[0]) });
    const hash = await w.writeContract({ address: tabAddress(), abi: tabAbi, functionName: "charge", args: [id, sid, BigInt(STEP_COST[step])] });
    const r = await pub.waitForTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error("charge reverted");
  } catch (e) {
    if (await pub.readContract({ address: tabAddress(), abi: tabAbi, functionName: "stepCharged", args: [id, sid] }).catch(() => false)) return; // a parallel call got there first
    console.error("[dreams] charge failed:", (e as Error).message.slice(0, 160));
    throw new TabError("chain", "The tab could not be charged. Nothing was used, try again.");
  }
}
