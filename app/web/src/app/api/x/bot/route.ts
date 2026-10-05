import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { botStatus, startOAuth, xConfigured } from "@/lib/xlink";

// Admin only: connect the @arctisans X account once so it can reply "Added to your profile".
const isAdmin = (w: string) => (process.env.ADMIN_WALLETS ?? "").toLowerCase().split(",").map((s) => s.trim()).includes(w);
export const GET = route("x-bot", 10, async (req) => {
  const { wallet } = requireSession(req);
  if (!isAdmin(wallet)) return fail(403, "Admins only");
  if (!xConfigured()) return fail(503, "X keys are not set");
  if (new URL(req.url).searchParams.get("start")) return ok({ url: await startOAuth(wallet, "bot") });
  return ok(await botStatus());
});
