import { del } from "@vercel/blob";
import { db } from "@/db";
import { isOurVideo } from "./video";

const json = <T,>(s: unknown, d: T): T => { try { return JSON.parse(String(s)) as T; } catch { return d; } };

/**
 * Delete a post and its media. Returns what was removed.
 * - video: the file in Vercel Blob (only if no other post points at the same file)
 * - pictures: unpinned from Pinata (only if no other post or profile uses the same picture)
 * Storage failures never block the delete: the post is gone either way, and the result says what could not be removed.
 */
export async function deletePostAndMedia(postId: string): Promise<{ deleted: boolean; video: "removed" | "none" | "kept" | "failed"; pictures: number; picturesFailed: number }> {
  const row = (await db().execute({ sql: "SELECT images, video FROM posts WHERE id=?", args: [postId] })).rows[0];
  if (!row) return { deleted: false, video: "none", pictures: 0, picturesFailed: 0 };
  const images = json<string[]>(row.images, []), video = row.video ? String(row.video) : null;
  await db().execute({ sql: "DELETE FROM posts WHERE id=?", args: [postId] });
  await db().execute({ sql: "DELETE FROM likes WHERE post_id=?", args: [postId] });
  await db().execute({ sql: "UPDATE post_requests SET status='approved' WHERE post_id=? AND status='pending'", args: [postId] });

  let v: "removed" | "none" | "kept" | "failed" = "none";
  if (video) {
    const shared = (await db().execute({ sql: "SELECT 1 FROM posts WHERE video=? LIMIT 1", args: [video] })).rows.length > 0;
    if (shared) v = "kept";
    else if (!isOurVideo(video)) v = "none";
    else { try { await del(video); v = "removed"; } catch (e) { console.error("[blob-del]", (e as Error).message); v = "failed"; } }
  }

  let pictures = 0, failed = 0;
  const jwt = process.env.PINATA_JWT;
  for (const ref of images) {
    if (!ref.startsWith("ipfs://") || !jwt) continue;
    const cid = ref.slice(7);
    const used = (await db().execute({ sql: "SELECT 1 FROM posts WHERE images LIKE ? UNION ALL SELECT 1 FROM users WHERE avatar=? OR cover=? OR cv LIKE ? LIMIT 1", args: [`%${cid}%`, ref, ref, `%${cid}%`] })).rows.length > 0;
    if (used) continue;
    try {
      const r = await fetch(`https://api.pinata.cloud/pinning/unpin/${cid}`, { method: "DELETE", headers: { Authorization: `Bearer ${jwt}` } });
      if (r.ok || r.status === 404) pictures++; else failed++;
    } catch { failed++; }
  }
  return { deleted: true, video: v, pictures, picturesFailed: failed };
}
