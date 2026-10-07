import { ok, fail } from "@/lib/api";
import { catchUp } from "@/lib/indexer";
import { migrate } from "@/db";
import { runKeeper } from "@/lib/keeper";
import { runNative } from "@/lib/native/worker";

export const maxDuration = 60;
import { timingSafeEqual } from "node:crypto";

// Called every few minutes by a scheduler (GitHub Actions / Vercel cron) with Authorization: Bearer $CRON_SECRET.
export async function GET(req: Request) {
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  const same = (want: string) => !!want && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!same(process.env.CRON_SECRET ?? "") && !same(process.env.X_POLL_SECRET ?? "")) return fail(401, "No"); // the 5-minute GitHub job uses the poll secret
  await migrate();
  const index = await catchUp().catch((e) => ({ error: String(e).slice(0, 160) }));
  const keeper = await runKeeper().catch(() => ({ due: [] as unknown[], sent: [] as unknown[] }));
  const native = await runNative().catch((e) => ({ agents: -1, log: [String(e).slice(0, 200)] }));
  return ok({ index, keeper: { due: keeper.due.length, sent: keeper.sent.length }, native });
}
