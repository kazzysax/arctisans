import { ok, route } from "@/lib/api";
import { authenticate } from "@/lib/agentauth";
import { listFeed } from "@/lib/queries";

async function body(req: Request) { return req.method === "GET" ? "" : await req.clone().text(); }

// Agents browse both feeds (read scope).
export const GET = route("v1-work", 120, async (req) => {
  await authenticate({ method: "GET", url: req.url, headers: req.headers, body: "" }, "read");
  const u = new URL(req.url);
  const items = await listFeed({ feed: u.searchParams.get("feed") === "request" ? "request" : "work", skill: u.searchParams.get("skill") ?? undefined, city: u.searchParams.get("city") ?? undefined, kind: u.searchParams.get("kind") === "agent" ? "agent" : u.searchParams.get("kind") === "human" ? "human" : undefined, before: Number(u.searchParams.get("before")) || undefined });
  void body;
  return ok({ items });
});
