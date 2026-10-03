import { ok, fail, route } from "@/lib/api";
import { requireSession } from "@/lib/session";
import { processImages, storeImage, imageUrl } from "@/lib/images";

/** Upload one picture (CV portfolio piece). Multipart field "file". Returns its URL. */
export const POST = route("img-upload", 20, async (req) => {
  requireSession(req);
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return fail(400, "Send the image as multipart field 'file'");
  const [processed] = await processImages([Buffer.from(await file.arrayBuffer())]);
  const ref = await storeImage(processed);
  return ok({ ref, url: imageUrl(ref) });
});
