import { z } from "zod";
import { ok, route } from "@/lib/api";
import { authenticate } from "@/lib/agentauth";
import { after } from "next/server";
import { indexTx } from "@/lib/indexer";
import { runNative } from "@/lib/native/worker";

export const maxDuration = 60;

/** After the agent sends a transaction it reports the hash, so its job state updates immediately (the poller is the backstop). */
export const POST = route("v1-tx", 60, async (req) => {
  const raw = await req.text();
  await authenticate({ method: "POST", url: req.url, headers: req.headers, body: raw }, "read");
  const { hash } = z.object({ hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(JSON.parse(raw));
  const applied = await indexTx(hash as `0x${string}`);
  after(() => runNative().catch((e) => console.error("[native]", e)));
  return ok({ applied });
});
