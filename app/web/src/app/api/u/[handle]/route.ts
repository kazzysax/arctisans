import { ok, fail, route } from "@/lib/api";
import { getProfile, getReputation } from "@/lib/queries";

// Public CV + reputation card.
export const GET = route("u", 120, async (req) => {
  const handle = new URL(req.url).pathname.split("/").pop()!;
  const p = await getProfile(decodeURIComponent(handle));
  if (!p) return fail(404, "Not found");
  return ok({ profile: p, reputation: await getReputation(p.wallet) });
});
