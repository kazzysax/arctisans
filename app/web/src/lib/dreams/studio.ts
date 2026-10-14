// Talks to Arc Studio's web API with the USER'S OWN personal token, so the build runs in their own Studio account without installing anything.
// The token is used for one request and never stored. Same calls the official arc-studio CLI makes (chat detached, messages).
const BASE = "https://studio.arc.io";
const UA = "arc-studio-cli/1.2.1";

export class StudioError extends Error { constructor(public code: "token" | "limit" | "down" | "bad", msg: string) { super(msg); } }
export const cleanToken = (t: unknown) => (typeof t === "string" ? t.trim() : "");
export const looksLikeToken = (t: string) => /^origin_pat_[A-Za-z0-9._-]{10,200}$/.test(t);

async function call(token: string, path: string, init?: RequestInit) {
  const r = await fetch(BASE + path, { ...init, headers: { "content-type": "application/json", "user-agent": UA, authorization: `Bearer ${token}`, ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(25_000) }).catch(() => null);
  if (!r) throw new StudioError("down", "Arc Studio did not answer. Try again in a moment.");
  if (r.status === 401 || r.status === 403) {
    const body = await r.text().catch(() => "");
    if (/blocked|cloudflare|attention required/i.test(body)) throw new StudioError("down", "Arc Studio blocked our request. Please try again later.");
    throw new StudioError("token", "Arc Studio did not accept that token. Open the Studio page again, click Authorize, and paste the new token.");
  }
  if (r.status === 429) throw new StudioError("limit", "Your Arc Studio has too many builds running. Pause one in Studio and try again.");
  if (r.status === 402 || r.status === 426) throw new StudioError("limit", "Your Arc Studio daily limit is used up. Try again tomorrow.");
  return r;
}

export async function checkToken(token: string) {
  const r = await call(token, "/api/whoami");
  if (!r.ok) throw new StudioError("bad", "Could not check that token.");
}

/** Sends the Dream Sheet as a new build in the user's Studio. */
export async function startBuild(token: string, sheet: string, skills: string[]) {
  const r = await call(token, "/api/chat", { method: "POST", body: JSON.stringify({ ...(skills.length ? { selectedSkills: skills } : {}), messages: [{ role: "user", content: sheet }], detached: true }) });
  if (r.status !== 202) throw new StudioError("bad", `Arc Studio could not start the build (${r.status}).`);
  const j = (await r.json().catch(() => ({}))) as { data?: { appId?: string; threadId?: string }; appId?: string; threadId?: string };
  const d = j.data ?? j;
  if (!d.appId || !d.threadId) throw new StudioError("bad", "Arc Studio did not return the build.");
  return { appId: d.appId, threadId: d.threadId };
}

export type BuildState = "building" | "done" | "stopped";
export async function buildState(token: string, threadId: string): Promise<BuildState> {
  const r = await call(token, `/api/messages?${new URLSearchParams({ threadId, pageSize: "50" })}`);
  if (!r.ok) throw new StudioError("down", "Could not read the build.");
  const j = (await r.json().catch(() => ({}))) as { data?: { items?: unknown[] }; items?: unknown[] };
  const items = (j.data?.items ?? j.items ?? []) as { role?: string; metadata?: { turnComplete?: boolean; interrupted?: boolean; error?: unknown } }[];
  const last = [...items].reverse().find((m) => m.role === "assistant");
  if (last?.metadata?.turnComplete) return "done";
  if (last?.metadata?.interrupted || last?.metadata?.error) return "stopped";
  return "building";
}

export const studioWebUrl = (appId: string) => `${BASE}/app/${encodeURIComponent(appId)}`;
export const studioLoginUrl = `${BASE}/cli-auth`;
