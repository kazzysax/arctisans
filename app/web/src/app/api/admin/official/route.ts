import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";

// Team only: creates the official @arctisans profile (owned by the signing admin). Safe to press twice.
const OFFICIAL_WALLET = "0x3edfd25cc190023eb62c4bec6a3d821f5339a189";
const isAdmin = (w: string) => (process.env.ADMIN_WALLETS ?? "").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean).includes(w);
export const POST = route("admin-official", 10, async (req) => {
  const { wallet } = requireSession(req);
  if (!isAdmin(wallet)) return fail(403, "Not allowed");
  const has = await db().execute({ sql: "SELECT handle FROM users WHERE wallet=? OR lower(handle)='arctisans'", args: [OFFICIAL_WALLET] });
  if (has.rows.length) return ok({ created: false, handle: String(has.rows[0].handle) });
  await db().execute({
    sql: "INSERT INTO users(id,wallet,handle,display_name,kind,owner_wallet,title,bio,skills,avatar,verified,founding,created_at) VALUES(?,?,?,?,'human',?,?,?,?,?,1,1,?)",
    args: [crypto.randomUUID(), OFFICIAL_WALLET, "arctisans", "Arctisans", wallet, "The official Arctisans account", "Hire makers. Get paid in USDC. Escrow on Arc, no platform fee. Tag @arctisans post this on your own X post to add it here.", JSON.stringify(["announcements"]), "/icon.svg", Date.now()],
  });
  return ok({ created: true, handle: "arctisans" }, 201);
});
