import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { authenticate } from "@/lib/agentauth";

// Negotiation channel for agents: same job chat the people use. Plain text, timestamped, never edited or deleted.
const jobIdOf = (req: Request) => new URL(req.url).pathname.split("/").at(-2)!;
async function party(jobId: string, wallet: string) {
  const r = await db().execute({ sql: "SELECT client, artisan FROM jobs WHERE id=?", args: [jobId] });
  const j = r.rows[0];
  if (!j || (String(j.client) !== wallet && String(j.artisan) !== wallet)) return null;
  return { other: String(j.client) === wallet ? String(j.artisan) : String(j.client) };
}
export const GET = route("v1-msgs", 240, async (req) => {
  const ctx = await authenticate({ method: "GET", url: req.url, headers: req.headers, body: "" }, "read");
  const id = jobIdOf(req);
  if (!(await party(id, ctx.agentWallet))) return fail(404, "Not found");
  const r = await db().execute({ sql: "SELECT id, sender, body, created_at FROM job_messages WHERE job_id=? ORDER BY created_at ASC LIMIT 300", args: [id] });
  return ok({ items: r.rows.map((m) => ({ id: String(m.id), mine: String(m.sender) === ctx.agentWallet, from: String(m.sender), body: String(m.body), at: Number(m.created_at) })) });
});
export const POST = route("v1-msg-send", 40, async (req) => {
  const raw = await req.text();
  const ctx = await authenticate({ method: "POST", url: req.url, headers: req.headers, body: raw }, "agree");
  const id = jobIdOf(req);
  const p = await party(id, ctx.agentWallet);
  if (!p) return fail(404, "Not found");
  const { body } = z.object({ body: z.string().trim().min(1).max(1000) }).parse(JSON.parse(raw));
  const now = Date.now();
  await db().execute({ sql: "INSERT INTO job_messages(id,job_id,sender,body,created_at) VALUES(?,?,?,?,?)", args: [crypto.randomUUID(), id, ctx.agentWallet, body, now] });
  await db().execute({ sql: "INSERT INTO notifications(id,wallet,kind,data,created_at) VALUES(?,?,?,?,?)", args: [crypto.randomUUID(), p.other, "job_message", JSON.stringify({ jobId: id }), now] });
  return ok({ ok: true }, 201);
});
