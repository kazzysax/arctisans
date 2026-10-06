// Fit an X video into our 20 MB limit. X gives several sizes of every video. We take the best one that fits whole;
// if none does, we keep good quality and cut it from the start to the length that fits (sound kept, no re-encode).
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ffmpegPath from "ffmpeg-static";

export const VIDEO_LIMIT = 20 * 1024 * 1024;
type Variant = { bit_rate?: number; content_type: string; url: string };
type Vid = { duration_ms?: number; variants?: Variant[] };

async function sizeOf(url: string) {
  const h = await fetch(url, { method: "HEAD" }).catch(() => null);
  return Number(h?.headers.get("content-length") ?? 0);
}
async function download(url: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`could not download the video (${r.status})`);
  return Buffer.from(await r.arrayBuffer());
}
function ffmpeg(args: string[], timeoutMs = 150_000) {
  return new Promise<void>((resolve, reject) => {
    if (!ffmpegPath) return reject(new Error("video tool missing on server"));
    const p = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => { err = (err + String(d)).slice(-400); });
    const t = setTimeout(() => { p.kill("SIGKILL"); reject(new Error("video cut took too long")); }, timeoutMs);
    p.on("error", (e) => { clearTimeout(t); reject(e); });
    p.on("close", (code) => { clearTimeout(t); if (code === 0) resolve(); else reject(new Error(`video cut failed: ${err.trim().split("\n").pop() ?? code}`)); });
  });
}
/** Cut the first `seconds` of a remote mp4 without re-encoding. ffmpeg only fetches the part it needs. */
async function cut(url: string, seconds: number) {
  const dir = await mkdtemp(path.join(tmpdir(), "xv-"));
  const out = path.join(dir, "out.mp4");
  try {
    await ffmpeg(["-hide_banner", "-loglevel", "error", "-y", "-i", url, "-t", String(seconds), "-map", "0:v:0", "-map", "0:a:0?", "-c", "copy", "-movflags", "+faststart", out]);
    return await readFile(out);
  } finally { await rm(dir, { recursive: true, force: true }).catch(() => {}); }
}

/** Returns the video bytes (≤ limit) and, if it had to be cut, the length in seconds it was cut to. */
export async function fitVideo(vid: Vid, limit = VIDEO_LIMIT): Promise<{ buf: Buffer; trimmedTo: number | null }> {
  const options = (vid.variants ?? []).filter((v) => v.content_type === "video/mp4").sort((a, b) => (b.bit_rate ?? 0) - (a.bit_rate ?? 0));
  if (!options.length) throw new Error("the video has no downloadable version");
  const sized = await Promise.all(options.map(async (o) => ({ o, bytes: await sizeOf(o.url) })));
  const total = vid.duration_ms ? vid.duration_ms / 1000 : null;

  // 1) best quality that fits whole, as long as it is still sharp (X's tiny 320p copies look soft: better to cut a sharp one)
  const SHARP = 800_000; // bits/s, about 480p on X
  const whole = sized.find((s) => s.bytes > 0 && s.bytes <= limit && (s.o.bit_rate ?? SHARP) >= SHARP);
  if (whole) {
    const buf = await download(whole.o.url);
    if (buf.length <= limit) return { buf, trimmedTo: null };
  }

  // 2) too big in every size: keep the best quality that still gives at least a minute, and cut to fit
  const target = limit * 0.88; // headroom: cuts land on keyframes and sizes vary across the video
  const bytesPerSec = (s: (typeof sized)[number]) => (total && s.bytes ? s.bytes / total : ((s.o.bit_rate ?? 1_000_000) + 128_000) / 8);
  const keep = (s: (typeof sized)[number]) => Math.floor(target / bytesPerSec(s));
  const want = Math.min(60, total ?? 60);
  const pick = sized.find((s) => keep(s) >= want) ?? sized[sized.length - 1];
  // if even the sharpest cut would be very short but a soft copy fits whole, the whole video is better
  const soft = sized.find((s) => s.bytes > 0 && s.bytes <= limit);
  if (soft && keep(pick) < want) { const buf = await download(soft.o.url); if (buf.length <= limit) return { buf, trimmedTo: null }; }
  let seconds = Math.max(5, Math.min(keep(pick), total ? Math.floor(total) : keep(pick)));
  for (let i = 0; i < 3; i++) {
    const buf = await cut(pick.o.url, seconds);
    if (buf.length <= limit && buf.length > 10_000) return { buf, trimmedTo: seconds };
    seconds = Math.max(5, Math.floor(seconds * 0.75));
  }
  throw new Error("could not fit the video under 20 MB");
}

/** Server self-check: runs the bundled ffmpeg and returns its version line. */
export async function videoToolCheck() {
  if (!ffmpegPath) throw new Error("ffmpeg-static has no binary for this platform");
  const { execFile } = await import("node:child_process");
  return await new Promise<string>((res, rej) => execFile(ffmpegPath!, ["-version"], { timeout: 15000 }, (e, out) => (e ? rej(e) : res(String(out).split("\n")[0]))));
}
