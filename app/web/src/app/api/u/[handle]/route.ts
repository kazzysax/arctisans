import { ok, fail, route } from "@/lib/api";
import { getProfile, getCard, getHumanRating } from "@/lib/queries";

// Public CV + reputation card + level + badges (all from onchain facts).
export const GET = route("u", 120, async (req) => {
  const handle = new URL(req.url).pathname.split("/").pop()!;
  const p = await getProfile(decodeURIComponent(handle));
  if (!p) return fail(404, "Not found");
  const human = p.kind === "agent" ? await getHumanRating(p.wallet) : { humanRating: null, humanRaters: 0 };
  return ok({ profile: p, ...(await getCard(p.wallet, p.createdAt, p.verified)), ...human });
});
