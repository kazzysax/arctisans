"use client";
// Browser side of Circle user-controlled wallets: sign-in (email OTP / Google) and approving transactions.
// The SDK shows Circle's own secure window for the code and for every approval, so we never see a PIN or key.
import type { W3SSdk as Sdk } from "@circle-fin/w3s-pw-web-sdk";

export const CIRCLE_APP_ID = process.env.NEXT_PUBLIC_CIRCLE_APP_ID ?? "";
export const circleReady = () => !!CIRCLE_APP_ID;
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";
export const googleReady = () => !!GOOGLE_CLIENT_ID;
// Google sends the browser away and back. These tokens survive the round trip in this tab, and the page it returns to.
const G_KEY = "arc_google_pending";
const G_RETURN = "/signup";
const googleCfg = () => ({ clientId: GOOGLE_CLIENT_ID, redirectUri: `${location.origin}${G_RETURN}`, selectAccountPrompt: true });
const pendingGoogle = (): { deviceToken: string; deviceEncryptionKey: string } | null => { try { return JSON.parse(sessionStorage.getItem(G_KEY) ?? "null"); } catch { return null; } };

type Login = { userToken: string; encryptionKey: string };
const KEY = "arc_circle_login";
let sdk: Sdk | null = null;
let onLogin: ((e: unknown, r?: Login) => void) | null = null;

export function savedLogin(): Login | null {
  try { return JSON.parse(sessionStorage.getItem(KEY) ?? "null"); } catch { return null; }
}
export const clearLogin = () => { try { sessionStorage.removeItem(KEY); } catch {} };

async function getSdk(): Promise<Sdk> {
  if (sdk) return sdk;
  const { W3SSdk } = await import("@circle-fin/w3s-pw-web-sdk");
  const g = googleReady() ? pendingGoogle() : null;
  sdk = new W3SSdk({ appSettings: { appId: CIRCLE_APP_ID }, ...(g ? { loginConfigs: { ...g, google: googleCfg() } } : {}) }, (error: unknown, result: unknown) => {
    if (!error && result) sessionStorage.setItem(KEY, JSON.stringify(result));
    onLogin?.(error, result as Login | undefined);
  });
  return sdk;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const r = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((j as { error?: string }).error ?? "Something went wrong");
  return j as T;
}

/** Emails a code, then opens Circle's window to enter it. Resolves with the signed-in login. */
export async function signInWithEmail(email: string): Promise<Login> {
  const s = await getSdk();
  const deviceId = await s.getDeviceId();
  const t = await post<{ deviceToken: string; deviceEncryptionKey: string; otpToken: string }>("/api/wallet/otp", { deviceId, email });
  return new Promise<Login>((resolve, reject) => {
    onLogin = (e, r) => (e || !r ? reject(new Error((e as Error)?.message ?? "Sign-in was cancelled")) : resolve(r));
    s.updateConfigs({ appSettings: { appId: CIRCLE_APP_ID }, loginConfigs: { deviceToken: t.deviceToken, deviceEncryptionKey: t.deviceEncryptionKey, otpToken: t.otpToken } });
    s.verifyOtp();
  });
}

/** Opens Google. The page leaves and comes back to /signup, where resumeGoogleLogin() picks up the result. */
export async function startGoogleSignIn(): Promise<void> {
  if (!googleReady()) throw new Error("Google sign-in is not set up yet");
  const s = await getSdk();
  const deviceId = await s.getDeviceId();
  const t = await post<{ deviceToken: string; deviceEncryptionKey: string }>("/api/wallet/social", { deviceId });
  sessionStorage.setItem(G_KEY, JSON.stringify(t));
  s.updateConfigs({ appSettings: { appId: CIRCLE_APP_ID }, loginConfigs: { ...t, google: googleCfg() } });
  const { SocialLoginProvider } = await import("@circle-fin/w3s-pw-web-sdk/dist/src/types");
  await s.performLogin(SocialLoginProvider.GOOGLE);
}
export const googlePending = () => typeof window !== "undefined" && googleReady() && !!pendingGoogle();
/** After Google sends the user back: resolves with the login, or null if they came back without finishing. */
export async function resumeGoogleLogin(): Promise<Login | null> {
  if (!pendingGoogle()) return null;
  const done = new Promise<Login | null>((resolve, reject) => {
    onLogin = (e, r) => (e || !r ? reject(new Error((e as Error)?.message ?? "Google sign-in was cancelled")) : resolve(r));
    setTimeout(() => resolve(null), 20000);
  });
  await getSdk();
  try { return await done; } finally { sessionStorage.removeItem(G_KEY); }
}

/** Run a Circle challenge (create wallet, or approve a transaction) in Circle's secure window. */
export async function runChallenge(login: Login, challengeId: string): Promise<void> {
  const s = await getSdk();
  s.setAuthentication({ userToken: login.userToken, encryptionKey: login.encryptionKey });
  return new Promise<void>((resolve, reject) => s.execute(challengeId, (error: unknown) => (error ? reject(new Error((error as Error).message ?? "Not approved")) : resolve())));
}

/** After sign-in: create the wallet on first visit, then ask our server to verify the token and set the session cookie. */
export async function finishLogin(login: Login): Promise<{ hasProfile: boolean }> {
  const init = await post<{ existing: boolean; challengeId?: string }>("/api/wallet/init", { userToken: login.userToken });
  if (!init.existing && init.challengeId) await runChallenge(login, init.challengeId);
  // Circle can take a moment to index a brand-new wallet.
  let lastErr: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      await post("/api/auth/circle", { userToken: login.userToken });
      const p = await fetch("/api/profile", { credentials: "include" });
      return { hasProfile: p.ok };
    } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 1200)); }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Wallet is not ready yet. Try again.");
}

export type Call = { to: string; data: string; label: string };

/**
 * Send onchain calls from the user's wallet, one at a time (fund = approve USDC, then fund).
 * Each call: server builds a Circle challenge -> user approves in Circle's window -> server waits for it to land and indexes it.
 * Returns the last tx hash, or null if the network is still confirming (the background indexer will catch up).
 */
export async function sendCalls(calls: Call[], onStep?: (label: string, i: number, n: number) => void): Promise<string | null> {
  const login = savedLogin();
  if (!login) throw new Error("Please sign in again to approve this.");
  let hash: string | null = null;
  for (let i = 0; i < calls.length; i++) {
    const c = calls[i];
    onStep?.(c.label, i, calls.length);
    const since = Date.now();
    const ch = await post<{ challengeId: string }>("/api/wallet/challenge", { userToken: login.userToken, to: c.to, data: c.data });
    await runChallenge(login, ch.challengeId);
    const r = await post<{ txHash: string | null }>("/api/wallet/settle", { userToken: login.userToken, since });
    hash = r.txHash;
  }
  return hash;
}
