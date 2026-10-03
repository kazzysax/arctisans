import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { processImages, storeImage } from "@/lib/images";

/** Upload / replace the signed-in user's avatar, or their cover photo with ?slot=cover. Multipart field "file". */
export const POST = route("avatar-upload", 10, async (req) => {
  const { wallet } = requireSession(req);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "Send the image as multipart field 'file'");
  const buf = Buffer.from(await file.arrayBuffer());
  const [processed] = await processImages([buf]);
  const ref = await storeImage(processed);
  const cover = new URL(req.url).searchParams.get("slot") === "cover";
  await db().execute({ sql: `UPDATE users SET ${cover ? "cover" : "avatar"}=? WHERE wallet=?`, args: [ref, wallet] });
  return ok({ [cover ? "cover" : "avatar"]: ref });
});
