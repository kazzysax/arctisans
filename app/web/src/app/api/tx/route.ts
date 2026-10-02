import { z } from "zod";
import { ok, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { indexTx } from "@/lib/indexer";

// After the user confirms, the client posts the tx hash so the UI updates immediately (the poller is the backstop).
export const POST = route("tx-index", 60, async (req) => {
  requireSession(req);
  const { hash } = z.object({ hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(await req.json());
  return ok({ applied: await indexTx(hash as `0x${string}`) });
});
