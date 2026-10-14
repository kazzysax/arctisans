import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { processImages, storeImage } from "@/lib/images";
import { chat } from "@/lib/native/llm";

export const maxDuration = 60;

// Lets the client of an agent job put the agent's delivery to use: set the delivered picture as their photo,
// or review and save the rewritten title / bio / skills. Only the client of that job, only text the agent sent.
const jobIdOf = (req: Request) => new URL(req.url).pathname.split("/").at(-2)!;
const BLOB = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s)]+$/i;

async function agentMessage(jobId: string, messageId: string, wallet: string) {
  const j = (await db().execute({ sql: "SELECT client, artisan FROM jobs WHERE id=?", args: [jobId] })).rows[0];
  if (!j || String(j.client) !== wallet) return null;
  const m = (await db().execute({ sql: "SELECT sender, body FROM job_messages WHERE id=? AND job_id=?", args: [messageId, jobId] })).rows[0];
  if (!m || String(m.sender) !== String(j.artisan)) return null; // must be written by the agent hired on this job
  const a = (await db().execute({ sql: "SELECT kind, handle FROM users WHERE wallet=?", args: [String(j.artisan)] })).rows[0];
  if (String(a?.kind) !== "agent") return null;
  return { body: String(m.body), handle: String(a.handle) };
}

const Proposal = z.object({
  title: z.string().trim().max(80).optional(),
  bio: z.string().trim().max(600).optional(),
  skills: z.array(z.string().trim().min(1).max(30)).max(12).optional(),
});

export const POST = route("job-apply", 20, async (req) => {
  const { wallet } = requireSession(req);
  const jobId = jobIdOf(req);
  const body = z.discriminatedUnion("action", [
    z.object({ action: z.literal("photo"), messageId: z.string().min(1) }),
    z.object({ action: z.literal("preview"), messageId: z.string().min(1) }),
    z.object({ action: z.literal("save"), proposal: Proposal }),
  ]).parse(await req.json());

  if (body.action === "save") {
    const p = body.proposal;
    if (!p.title && !p.bio && !p.skills?.length) return fail(400, "Nothing to save");
    const cur = (await db().execute({ sql: "SELECT title, bio, skills FROM users WHERE wallet=?", args: [wallet] })).rows[0];
    if (!cur) return fail(404, "Finish setting up your profile first");
    // the job must be one of yours with an agent, so this cannot be used as a general profile writer
    const j = (await db().execute({ sql: "SELECT client FROM jobs WHERE id=?", args: [jobId] })).rows[0];
    if (!j || String(j.client) !== wallet) return fail(404, "Not found");
    await db().execute({
      sql: "UPDATE users SET title=?, bio=?, skills=? WHERE wallet=?",
      args: [p.title ?? (cur.title as string | null), p.bio ?? (cur.bio as string | null), p.skills?.length ? JSON.stringify(p.skills.map((s) => s.toLowerCase())) : String(cur.skills ?? "[]"), wallet],
    });
    return ok({ saved: true });
  }

  const m = await agentMessage(jobId, body.messageId, wallet);
  if (!m) return fail(404, "Not found");

  if (body.action === "photo") {
    const url = m.body.match(/https:\/\/[^\s)]+/g)?.find((u) => BLOB.test(u));
    if (!url) return fail(400, "No picture in that message");
    const r = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) return fail(502, "Could not load the picture");
    const [img] = await processImages([Buffer.from(await r.arrayBuffer())]);
    const ref = await storeImage(img);
    await db().execute({ sql: "UPDATE users SET avatar=? WHERE wallet=?", args: [ref, wallet] });
    return ok({ avatar: ref });
  }

  // preview: pull the title, bio and skills out of the agent's text so the person can check them before saving
  const raw = await chat(
    "Extract the PROPOSED new profile fields from this text. Reply with ONLY a JSON object: {\"title\": string, \"bio\": string, \"skills\": string[]}. Use the exact wording proposed. Omit a key if the text proposes nothing for it. title max 80 chars, bio max 600 chars, up to 12 short skills.",
    m.body.slice(0, 6000), 700,
  );
  const json = raw.match(/\{[\s\S]*\}/)?.[0];
  let parsed: z.infer<typeof Proposal> = {};
  try { parsed = Proposal.parse(JSON.parse(json ?? "{}")); } catch { return fail(422, "Could not read the new profile from that message. Copy it by hand instead."); }
  if (!parsed.title && !parsed.bio && !parsed.skills?.length) return fail(422, "No profile changes found in that message");
  const cur = (await db().execute({ sql: "SELECT title, bio, skills FROM users WHERE wallet=?", args: [wallet] })).rows[0];
  return ok({ proposal: parsed, current: { title: cur?.title ?? null, bio: cur?.bio ?? null, skills: JSON.parse(String(cur?.skills ?? "[]")) } });
});
