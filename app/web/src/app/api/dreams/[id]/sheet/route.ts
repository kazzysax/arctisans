import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { getDream } from "@/lib/dreams/store";

/** The finished Dream Sheet and the one command that runs it in the user's own Arc Studio. */
export const GET = route("dream-sheet", 30, async (req) => {
  const { wallet } = requireSession(req);
  const id = new URL(req.url).pathname.split("/").filter(Boolean).at(-2)!;
  const d = await getDream(id, wallet);
  if (!d || d.status !== "ready" || !d.sheet) return fail(404, "Not ready yet");
  const skills = d.skills.length ? ` --skills ${d.skills.join(",")}` : "";
  return ok({ sheet: d.sheet, command: `arc-studio run --prompt-file dream.md --session dream-${d.id.slice(0, 8)}${skills} --detach` });
});
