// Thin server-side client for Circle's user-controlled wallets REST API. The API key never leaves the server.
// Docs: developers.circle.com/api-reference/wallets/user-controlled-wallets
const BASE = "https://api.circle.com/v1/w3s";

export class CircleError extends Error {
  constructor(public status: number, public code: number | null, message: string) { super(message); }
}

function key() {
  const k = process.env.CIRCLE_API_KEY;
  if (!k) throw new CircleError(503, null, "Sign-in is not configured yet");
  return k;
}

/** Which Circle blockchain our wallets live on (e.g. ARC-TESTNET while testing, ARC on mainnet). */
export const circleChain = () => process.env.CIRCLE_BLOCKCHAIN ?? "ARC";

async function call<T>(path: string, init: { method?: string; body?: unknown; userToken?: string } = {}): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    method: init.method ?? (init.body ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json", ...(init.userToken ? { "X-User-Token": init.userToken } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as { data?: T; code?: number; message?: string };
  if (!r.ok) throw new CircleError(r.status, j.code ?? null, j.message ?? "Circle request failed");
  return j.data as T;
}

/** Step 1 of email sign-in: Circle emails the code and returns the tokens the browser SDK needs to verify it. */
export const requestEmailOtp = (deviceId: string, email: string) =>
  call<{ deviceToken: string; deviceEncryptionKey: string; otpToken: string }>("/users/email/token", { body: { idempotencyKey: crypto.randomUUID(), deviceId, email } });

/** Step 1 of Google sign-in: Circle returns the device tokens the browser SDK needs before it redirects to Google. */
export const requestSocialToken = (deviceId: string) =>
  call<{ deviceToken: string; deviceEncryptionKey: string }>("/users/social/token", { body: { idempotencyKey: crypto.randomUUID(), deviceId } });

/** First sign-in only: returns a challenge the user approves in Circle's hosted UI to create their wallet. */
export const initializeUser = (userToken: string) =>
  call<{ challengeId: string }>("/user/initialize", { userToken, body: { idempotencyKey: crypto.randomUUID(), accountType: "SCA", blockchains: [circleChain()] } });

export type CircleWallet = { id: string; address: string; blockchain: string };
export const listWallets = async (userToken: string) => (await call<{ wallets: CircleWallet[] }>("/wallets", { userToken })).wallets ?? [];
export const arcWallet = async (userToken: string) => (await listWallets(userToken)).find((w) => w.blockchain.startsWith("ARC")) ?? null;

/** A contract call from the user's wallet. Circle returns a challenge; the user approves it in the SDK. Gas is sponsored by our Gas Station policy. */
export const contractChallenge = (userToken: string, walletId: string, to: string, data: string) =>
  call<{ challengeId: string }>("/user/transactions/contractExecution", { userToken, body: { idempotencyKey: crypto.randomUUID(), walletId, contractAddress: to, callData: data, feeLevel: "MEDIUM" } });

export const getTransaction = (userToken: string, id: string) =>
  call<{ transaction: { id: string; state: string; txHash?: string; errorReason?: string } }>(`/transactions/${id}`, { userToken });

export type CircleTx = { id: string; state: string; txHash?: string; createDate: string; errorReason?: string };
/** Newest transactions for a wallet, used to find the one the user just approved. */
export const recentTransactions = async (userToken: string, walletId: string) =>
  (await call<{ transactions: CircleTx[] }>(`/transactions?walletIds=${encodeURIComponent(walletId)}&pageSize=5&order=DESC`, { userToken })).transactions ?? [];
