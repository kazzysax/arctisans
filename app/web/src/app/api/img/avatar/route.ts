import { db } from "@/db";
import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { processImages, storeImage } from "@/lib/images";

/** Upload / replace the authenticated user's avatar. Accepts multipart with field "file". */
export const POST = route("avatar-upload", 10, async (req) => {
  const { wallet } = requireSession(req);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "Send the image as multipart field 'file'");
  const buf = Buffer.from(await file.arrayBuffer());
  const [processed] = await processImages([buf]);
  const ref = await storeImage(processed);
  await db().execute({ sql: "UPDATE users SET avatar=? WHERE wallet=?", args: [ref, wallet] });
  return ok({ avatar: ref });
});
