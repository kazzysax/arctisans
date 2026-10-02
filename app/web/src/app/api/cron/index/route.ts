import { ok, fail } from "@/lib/api";
import { catchUp } from "@/lib/indexer";
import { migrate } from "@/db";
import { runKeeper } from "@/lib/keeper";
import { timingSafeEqual } from "node:crypto";

// Called every few minutes by a scheduler (GitHub Actions / Vercel cron) with Authorization: Bearer $CRON_SECRET.
export async function GET(req: Request) {
  const want = process.env.CRON_SECRET ?? "";
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!want || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return fail(401, "No");
  await migrate();
  const index = await catchUp();
  const keeper = await runKeeper();
  return ok({ index, keeper: { due: keeper.due.length, sent: keeper.sent.length } });
}
