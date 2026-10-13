import { z } from "zod";
import { requirePayment } from "@/lib/dreams/nano";
import { getDreamById, doResearch } from "@/lib/dreams/store";

export const maxDuration = 60;
const B = z.object({ dream: z.string().uuid() });

/** Scout's paid endpoint (x402 on Circle Gateway). Mochi pays $0.03, then Scout researches. */
export async function POST(req: Request) {
  const pay = await requirePayment(req, "scout");
  if (pay instanceof Response) return pay;
  const b = B.safeParse(await req.json().catch(() => ({})));
  if (!b.success || !(await getDreamById(b.data.dream))) return Response.json({ error: "Unknown dream" }, { status: 400 });
  try { const d = await doResearch(b.data.dream); return Response.json({ status: d.status }); }
  catch (e) { console.error("[dog-scout]", (e as Error).message); return Response.json({ error: "Scout lost the scent" }, { status: 502 }); }
}
