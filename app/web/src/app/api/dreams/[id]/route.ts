import { z } from "zod";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getDream, markPaid, verifyEntry, advance, view } from "@/lib/dreams/store";

export const maxDuration = 60;
const idOf = (req: Request) => new URL(req.url).pathname.split("/").filter(Boolean).at(-1)!;

export const GET = route("dream-get", 120, async (req) => {
  const { wallet } = requireSession(req);
  const d = await getDream(idOf(req), wallet);
  return d ? ok(view(d)) : fail(404, "Not found");
});

const B = z.object({
  hash: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  answers: z.record(z.string().max(24), z.object({ optionId: z.string().max(24) })).optional(),
});

/** One endpoint moves the dream forward: send the payment hash first, then answers as the dogs ask. */
export const POST = route("dream-step", 20, async (req) => {
  const { wallet } = requireSession(req);
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-1)!;
  const b = B.parse(await req.json());
  let d = await getDream(id, wallet);
  if (!d) return fail(404, "Not found");
  if (d.status === "new") {
    if (!b.hash) return fail(402, "Pay the $1 to enter the arena");
    if (!(await verifyEntry(b.hash as `0x${string}`, wallet))) return fail(409, "That payment has not landed yet. Try again in a few seconds.");
    const m = await markPaid(id, wallet, b.hash);
    if (m === "used") return fail(409, "That payment was already used for another dream.");
    d = (await getDream(id, wallet))!;
  }
  try {
    const next = await advance(d, b.answers ? Object.fromEntries(Object.entries(b.answers).map(([k, v]) => [k, { optionId: v.optionId, label: "" }])) : undefined);
    return ok(view(next));
  } catch (e) {
    const m = (e as Error).message;
    if (/^(Only|Over)/.test(m)) return fail(400, m);
    console.error("[dream-step]", m);
    return fail(502, "The dogs lost the scent. Nothing was used, try that again.");
  }
});
