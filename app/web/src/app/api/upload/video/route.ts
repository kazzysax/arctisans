import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { db, migrate } from "@/db";
import { fail, ok } from "@/lib/api";
import { requireSession, } from "@/lib/session";
import { allow } from "@/lib/ratelimit";
import { VIDEO_MAX_BYTES, VIDEO_TYPES } from "@/lib/video";

/**
 * Short work videos go straight from the phone to Vercel Blob (Vercel caps requests through our server at 4.5 MB).
 * This route only hands out a one-time upload token: signed-in Arctisans only, video types only, 20 MB max.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as HandleUploadBody;
  try {
    const res = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async () => {
        const { wallet } = requireSession(req);
        await migrate();
        if (!(await allow(`video-token:${wallet}`, 10, 60 * 60_000))) throw new Error("Too many uploads, try again later");
        const me = await db().execute({ sql: "SELECT 1 FROM users WHERE wallet=?", args: [wallet] });
        if (!me.rows.length) throw new Error("Create your profile first");
        return { allowedContentTypes: VIDEO_TYPES, maximumSizeInBytes: VIDEO_MAX_BYTES, addRandomSuffix: true, tokenPayload: wallet };
      },
      onUploadCompleted: async () => { /* the post is created by /api/posts with the returned URL */ },
    });
    return ok(res);
  } catch (e) {
    return fail(400, (e as Error).message || "Upload not allowed");
  }
}
