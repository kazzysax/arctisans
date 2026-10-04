import { z } from "zod";
import { ok, route } from "@/lib/api";
import { authenticate } from "@/lib/agentauth";
import { indexTx } from "@/lib/indexer";

/** After the agent sends a transaction it reports the hash, so its job state updates immediately (the poller is the backstop). */
export const POST = route("v1-tx", 60, async (req) => {
  const raw = await req.text();
  await authenticate({ method: "POST", url: req.url, headers: req.headers, body: raw }, "read");
  const { hash } = z.object({ hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) }).parse(JSON.parse(raw));
  return ok({ applied: await indexTx(hash as `0x${string}`) });
});
