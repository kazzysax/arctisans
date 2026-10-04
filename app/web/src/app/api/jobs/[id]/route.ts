import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { TermsSchema, hashTerms, totalOf } from "@/lib/terms";
import { imageUrl } from "@/lib/images";
import { Act, ActError, buildJobCalls } from "@/lib/jobactions";

async function load(id: string) {
  const r = await db().execute({ sql: "SELECT * FROM jobs WHERE id=?", args: [id] });
  return r.rows[0] ?? null;
}
const idOf = (req: Request) => new URL(req.url).pathname.split("/").pop()!;

export const GET = route("job", 120, async (req) => {
  const { wallet } = requireSession(req);
  const j = await load(idOf(req));
  if (!j || (String(j.client) !== wallet && String(j.artisan) !== wallet)) return fail(404, "Not found");
  const terms = TermsSchema.parse(JSON.parse(String(j.terms)));
  const cid = j.chain_job_id == null ? null : Number(j.chain_job_id);
  // What the invoice screen shows: states, money and receipt links come from chain_events, not from us.
  const ev = cid == null ? [] : (await db().execute({ sql: "SELECT name, tx, ts, args FROM chain_events WHERE contract='escrow' AND json_extract(args,'$.jobId')=? ORDER BY block, id", args: [String(cid)] })).rows
    .map((e) => ({ event: String(e.name), tx: String(e.tx), ts: e.ts ? Number(e.ts) : null, args: JSON.parse(String(e.args ?? "{}")) as Record<string, unknown> }));
  const released = ev.filter((e) => e.event === "Released").reduce((a, e) => a + Number(e.args.net ?? 0) + Number(e.args.fee ?? 0), 0);
  const offers = ev.filter((e) => e.event === "SplitOffered"), opened = ev.filter((e) => e.event === "SettlementOpened").at(-1);
  const lastOffer = offers.at(-1);
  const party = async (w: string) => (await db().execute({ sql: "SELECT handle, display_name, avatar FROM users WHERE wallet=?", args: [w] })).rows[0];
  const [c, a] = [await party(String(j.client)), await party(String(j.artisan))];
  const card = (w: string, r: typeof c) => ({ wallet: w, handle: r ? String(r.handle) : null, name: r ? String(r.display_name) : w.slice(0, 8), avatar: r?.avatar ? imageUrl(String(r.avatar)) : null });
  return ok({
    id: String(j.id), chainJobId: cid, status: String(j.status), terms, termsHash: hashTerms(terms), me: isMeRole(wallet, j),
    client: card(String(j.client), c), artisan: card(String(j.artisan), a), total: totalOf(terms), released,
    deadlockAt: opened ? Number(opened.args.deadlockAt ?? 0) : null,
    splitOffer: lastOffer ? { by: String(lastOffer.args.by).toLowerCase(), toArtisan: Number(lastOffer.args.toArtisan), toClient: Number(lastOffer.args.toClient) } : null,
    timeline: ev.map(({ event, tx, ts }) => ({ event, tx, ts })),
  });
});
const isMeRole = (wallet: string, j: Record<string, unknown>) => (String(j.client) === wallet ? "client" : "artisan");

/** Returns the exact call(s) for the user to confirm. Only the right party gets the call; the contract enforces it again. */
export const POST = route("job-act", 60, async (req) => {
  const { wallet } = requireSession(req);
  const j = await load(idOf(req));
  if (!j) return fail(404, "Not found");
  try { return ok({ calls: await buildJobCalls(j, wallet, Act.parse(await req.json())) }); }
  catch (e) { if (e instanceof ActError) return fail(e.status, e.message); throw e; }
});
