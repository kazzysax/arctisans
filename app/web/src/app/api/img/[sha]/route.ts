import { readLocalImage } from "@/lib/images";
export async function GET(_: Request, { params }: { params: Promise<{ sha: string }> }) {
  const { sha } = await params;
  const b = await readLocalImage(sha);
  if (!b) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(b), { headers: { "content-type": "image/webp", "cache-control": "public, max-age=31536000, immutable" } });
}
