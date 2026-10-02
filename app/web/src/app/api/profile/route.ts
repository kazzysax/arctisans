import { z } from "zod";
import { getAddress } from "viem";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getProfile } from "@/lib/queries";

const Link = z.object({ label: z.string().min(1).max(30), url: z.string().url().max(300).refine((u) => /^https?:\/\//.test(u), "http(s) links only") });
const Body = z.object({
  handle: z.string().regex(/^[a-z0-9_]{3,20}$/, "3-20 lowercase letters, numbers or _"),
  displayName: z.string().min(1).max(60),
  kind: z.enum(["human", "agent"]).default("human"),
  ownerWallet: z.string().optional(),
  title: z.string().max(80).optional(), bio: z.string().max(600).optional(), scope: z.string().max(1200).optional(),
  skills: z.array(z.string().min(1).max(30)).max(12).default([]),
  links: z.array(Link).max(8).default([]), city: z.string().max(60).optional(),
});

// Create or update my CV. The CV page is generated from this.
export const PUT = route("profile", 30, async (req) => {
  const { wallet } = requireSession(req);
  const b = Body.parse(await req.json());
  if (b.kind === "agent" && !b.ownerWallet) return fail(400, "An agent needs a human owner wallet");
  const owner = b.kind === "agent" ? getAddress(b.ownerWallet!).toLowerCase() : null;
  const taken = await db().execute({ sql: "SELECT wallet FROM users WHERE lower(handle)=? AND wallet<>?", args: [b.handle, wallet] });
  if (taken.rows.length) return fail(409, "That handle is taken");
  await db().execute({
    sql: `INSERT INTO users(id,wallet,handle,display_name,kind,owner_wallet,title,bio,scope,skills,links,city,created_at)
          VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
          ON CONFLICT(wallet) DO UPDATE SET handle=excluded.handle, display_name=excluded.display_name, kind=excluded.kind,
            owner_wallet=excluded.owner_wallet, title=excluded.title, bio=excluded.bio, scope=excluded.scope,
            skills=excluded.skills, links=excluded.links, city=excluded.city`,
    args: [crypto.randomUUID(), wallet, b.handle, b.displayName, b.kind, owner, b.title ?? null, b.bio ?? null, b.scope ?? null,
      JSON.stringify(b.skills.map((s) => s.toLowerCase())), JSON.stringify(b.links), b.city ?? null, Date.now()],
  });
  return ok(await getProfile(wallet));
});
export const GET = route("profile-me", 120, async (req) => {
  const { wallet } = requireSession(req);
  const p = await getProfile(wallet);
  return p ? ok(p) : fail(404, "No profile yet");
});
