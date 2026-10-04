import { z } from "zod";
import { getAddress, verifyMessage } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { registrationMessage } from "@/lib/agentreg";

const MAX_AGENTS = 5;
const Body = z.object({
  handle: z.string().regex(/^[a-z0-9_]{3,20}$/, "3-20 lowercase letters, numbers or _"),
  displayName: z.string().min(1).max(60), title: z.string().max(80).optional(), bio: z.string().max(600).optional(),
  craft: z.string().max(30).optional(), skills: z.array(z.string().min(1).max(30)).max(8).default([]),
  rateFrom: z.number().int().min(0).max(100).optional(), rateTo: z.number().int().min(0).max(100).optional(),
  agentWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  signature: z.string().regex(/^0x[a-fA-F0-9]{130}$/, "Invalid signature"),
});

/**
 * The OWNER (signed in as a person) registers an agent. The agent wallet must prove it holds its own key by signing
 * the registration message, so nobody can register someone else's address. The owner stays accountable on the profile.
 */
export const POST = route("agent-create", 10, async (req) => {
  const { wallet: owner } = requireSession(req);
  const b = Body.parse(await req.json());
  const me = await db().execute({ sql: "SELECT kind FROM users WHERE wallet=?", args: [owner] });
  if (!me.rows[0]) return fail(409, "Set up your own profile first");
  if (String(me.rows[0].kind) !== "human") return fail(403, "Only a person can register an agent");
  const agent = getAddress(b.agentWallet).toLowerCase();
  if (agent === owner) return fail(400, "An agent needs its own wallet, different from yours");
  const good = await verifyMessage({ address: agent as `0x${string}`, message: registrationMessage(b.handle, agent, owner), signature: b.signature as `0x${string}` }).catch(() => false);
  if (!good) return fail(400, "That signature does not match this agent wallet, handle and owner");
  if ((await db().execute({ sql: "SELECT 1 FROM users WHERE wallet=?", args: [agent] })).rows.length) return fail(409, "That wallet already has a profile");
  if ((await db().execute({ sql: "SELECT 1 FROM users WHERE lower(handle)=?", args: [b.handle] })).rows.length) return fail(409, "That handle is taken");
  const n = await db().execute({ sql: "SELECT COUNT(*) n FROM users WHERE owner_wallet=?", args: [owner] });
  if (Number(n.rows[0].n) >= MAX_AGENTS) return fail(400, `You can register up to ${MAX_AGENTS} agents`);
  const cv = { craft: b.craft, availability: "open", rate: b.rateFrom, tools: [], clients: [], portfolio: [], ...(b.rateTo ? { rateTo: b.rateTo } : {}) };
  await db().execute({
    sql: "INSERT INTO users(id,wallet,handle,display_name,kind,owner_wallet,title,bio,skills,cv,created_at) VALUES(?,?,?,?,'agent',?,?,?,?,?,?)",
    args: [crypto.randomUUID(), agent, b.handle, b.displayName, owner, b.title ?? null, b.bio ?? null, JSON.stringify(b.skills.map((s) => s.toLowerCase())), JSON.stringify(cv), Date.now()],
  });
  return ok({ handle: b.handle, agentWallet: agent }, 201);
});
