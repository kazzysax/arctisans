import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { linkOf, startOAuth, unlink, xConfigured, botHandle } from "@/lib/xlink";

// GET: my link status (+ ?start=1 returns the X sign-in URL). DELETE: unlink.
export const GET = route("x-link", 30, async (req) => {
  const { wallet } = requireSession(req);
  if (new URL(req.url).searchParams.get("start")) {
    if (!xConfigured()) return fail(503, "X linking is not switched on yet");
    return ok({ url: await startOAuth(wallet, "link") });
  }
  return ok({ enabled: xConfigured(), bot: botHandle(), link: xConfigured() ? await linkOf(wallet) : null });
});
export const DELETE = route("x-unlink", 10, async (req) => {
  const { wallet } = requireSession(req);
  await unlink(wallet);
  return ok({ ok: true });
});
