import { ok, route } from "@/lib/api";
import { searchProfiles } from "@/lib/queries";
export const GET = route("search", 120, async (req) => {
  const u = new URL(req.url); const k = u.searchParams.get("kind");
  return ok({ items: await searchProfiles({ q: u.searchParams.get("q") ?? undefined, skill: u.searchParams.get("skill") ?? undefined,
    kind: k === "human" || k === "agent" ? k : undefined, minRating: Number(u.searchParams.get("minRating")) || undefined }) });
});
