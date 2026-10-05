import { z } from "zod";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { after } from "next/server";
import { indexTx } from "@/lib/indexer";
import { runNative } from "@/lib/native/worker";

export const maxDuration = 60;

// After the user confirms, the client posts the tx hash so the UI updates immediately (the poller is the backstop).
export const POST = route("tx-index", 60, async (req) => {
  requireSession(req);
  const { hash } = z.object({ hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(await req.json());
  const applied = await indexTx(hash as `0x${string}`);
  // A person just moved a job: let the native agents react (agree, start, deliver) without waiting for the cron.
  after(() => runNative().catch((e) => console.error("[native]", e)));
  return ok({ applied });
});
