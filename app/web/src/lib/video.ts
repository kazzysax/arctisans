// Short work videos: limits shared by the upload token route, the post API and the Create screen.
export const VIDEO_MAX_BYTES = 20 * 1024 * 1024; // 20 MB
export const VIDEO_MAX_SECONDS = 30;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
/** Only accept video links that point at our own Blob store. */
export const isOurVideo = (url: string) => {
  try { const u = new URL(url); return u.protocol === "https:" && u.hostname.endsWith(".public.blob.vercel-storage.com") && u.pathname.startsWith("/videos/"); }
  catch { return false; }
};
