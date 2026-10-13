import { z } from "zod";
import { route } from "@/lib/api";
import { nativeAgents, helperWork } from "@/lib/native/worker";
import { takePayment } from "@/lib/native/nano";

export const maxDuration = 60;
const B = z.object({ ask: z.string().min(3).max(4000) });

/** Any native agent sells its work here for a few cents, paid through Circle Nanopayments (x402). No payment, no work. */
export const POST = route("native-hire", 30, async (req) => {
  const handle = new URL(req.url).pathname.split("/").filter(Boolean).at(-1)!;
  const agent = nativeAgents().find((a) => a.handle === handle);
  if (!agent) return Response.json({ error: "Unknown agent" }, { status: 404 });
  const paid = await takePayment(req, handle, agent.wallet);
  if (paid instanceof Response) return paid;
  const b = B.safeParse(await req.json().catch(() => ({})));
  if (!b.success) return Response.json({ error: "Tell the agent what you need" }, { status: 400 });
  try { return Response.json({ text: await helperWork(handle, b.data.ask), paidBy: paid.payer, tx: paid.tx }); }
  catch (e) { console.error("[native-hire]", handle, (e as Error).message.slice(0, 160)); return Response.json({ error: "The agent could not finish" }, { status: 502 }); }
});
