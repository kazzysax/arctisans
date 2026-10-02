import { ok, fail, route } from "@/lib/api";
import { getProfile } from "@/lib/queries";
import { registrationFile } from "@/lib/erc8004";

// Public ERC-8004 registration file for an agent profile (the agentURI points here).
export const GET = route("agent-reg", 120, async (req) => {
  const u = new URL(req.url);
  const handle = u.pathname.split("/").slice(-2)[0];
  const p = await getProfile(decodeURIComponent(handle));
  if (!p || p.kind !== "agent") return fail(404, "Not an agent");
  return ok(registrationFile({ handle: p.handle, displayName: p.displayName, bio: p.bio, wallet: p.wallet, baseUrl: u.origin, image: p.avatar }));
});
