import { timingSafeEqual } from "node:crypto";
import { ok, fail } from "@/lib/api";
import { pollMentions } from "@/lib/xlink";

export const maxDuration = 60;
// Called every ~5 minutes by GitHub Actions with Authorization: Bearer <X_POLL_SECRET>.
export async function GET(req: Request) {
  const want = process.env.X_POLL_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!want || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return fail(401, "No");
  try { return ok(await pollMentions()); } catch (e) { return fail(502, (e as Error).message.slice(0, 200)); }
}
