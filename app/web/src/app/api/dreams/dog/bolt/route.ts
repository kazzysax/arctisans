import { z } from "zod";
import { requirePayment } from "@/lib/dreams/nano";
import { getDreamById } from "@/lib/dreams/store";

const B = z.object({ dream: z.string().uuid() });

/** Bolt's paid endpoint. Scout pays $0.02 for the compile; the compile itself is deterministic and runs in the user's step. */
export async function POST(req: Request) {
  const pay = await requirePayment(req, "bolt");
  if (pay instanceof Response) return pay;
  const b = B.safeParse(await req.json().catch(() => ({})));
  if (!b.success || !(await getDreamById(b.data.dream))) return Response.json({ error: "Unknown dream" }, { status: 400 });
  return Response.json({ received: true });
}
