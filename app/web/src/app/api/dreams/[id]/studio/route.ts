import { z } from "zod";
import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getDream } from "@/lib/dreams/store";
import { cleanToken, looksLikeToken, checkToken, startBuild, buildState, studioWebUrl, studioLoginUrl, StudioError } from "@/lib/dreams/studio";

export const maxDuration = 60;
const idOf = (req: Request) => new URL(req.url).pathname.split("/").filter(Boolean).at(-2)!;
const fromStudio = (e: unknown) => {
  if (e instanceof StudioError) return fail(e.code === "token" ? 401 : e.code === "limit" ? 429 : 502, e.message);
  throw e;
};

/** Where this dream's build stands (no token needed): the link to open it, if it was already sent. */
export const GET = route("dream-studio", 60, async (req) => {
  const { wallet } = requireSession(req);
  const d = await getDream(idOf(req), wallet);
  if (!d) return fail(404, "Not found");
  const r = (await db().execute({ sql: "SELECT studio_app FROM dreams WHERE id=?", args: [d.id] })).rows[0];
  const app = r?.studio_app ? String(r.studio_app) : null;
  return ok({ loginUrl: studioLoginUrl, sent: !!app, webUrl: app ? studioWebUrl(app) : null });
});

/**
 * Send the finished Dream Sheet to the user's own Arc Studio, or check how the build is going.
 * The user pastes their personal Studio token; it is used for this request only and is never saved.
 */
export const POST = route("dream-studio-send", 12, async (req) => {
  const { wallet } = requireSession(req);
  const b = z.object({ action: z.enum(["send", "status"]), token: z.string().max(400) }).parse(await req.json());
  const token = cleanToken(b.token);
  if (!looksLikeToken(token)) return fail(400, "That does not look like an Arc Studio token. It starts with origin_pat_ and is shown after you click Authorize.");
  const d = await getDream(idOf(req), wallet);
  if (!d) return fail(404, "Not found");
  const row = (await db().execute({ sql: "SELECT studio_app, studio_thread FROM dreams WHERE id=?", args: [d.id] })).rows[0];
  try {
    if (b.action === "status") {
      if (!row?.studio_thread) return fail(404, "This dream has not been sent to Studio yet");
      const state = await buildState(token, String(row.studio_thread));
      return ok({ state, webUrl: studioWebUrl(String(row.studio_app)) });
    }
    if (d.status !== "ready" || !d.sheet) return fail(409, "The Dream Sheet is not ready yet");
    if (row?.studio_app) return ok({ state: "building", webUrl: studioWebUrl(String(row.studio_app)), already: true }); // never start a second build for one dream
    await checkToken(token);
    const { appId, threadId } = await startBuild(token, d.sheet, d.skills);
    await db().execute({ sql: "UPDATE dreams SET studio_app=?, studio_thread=?, updated_at=? WHERE id=?", args: [appId, threadId, Date.now(), d.id] });
    return ok({ state: "building", webUrl: studioWebUrl(appId) }, 201);
  } catch (e) { return fromStudio(e); }
});
