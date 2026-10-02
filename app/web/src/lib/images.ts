import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";

export const MAX_IMAGES = 3;
const MAX_INPUT = 10 * 1024 * 1024;
const MAX_DIM = 2000;

export type ProcessedImage = { buffer: Buffer; sha256: string; width: number; height: number; bytes: number };

/** Pictures only: real JPG/PNG/WebP, resized, metadata stripped, re-encoded to WebP. */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.length === 0 || input.length > MAX_INPUT) throw new Error("Image must be under 10 MB");
  let meta;
  try {
    meta = await sharp(input, { failOn: "error" }).metadata();
  } catch {
    throw new Error("Not a valid image");
  }
  if (!meta.format || !["jpeg", "png", "webp"].includes(meta.format)) throw new Error("Only JPG, PNG or WebP pictures are allowed");
  if ((meta.pages ?? 1) > 1) throw new Error("Animated images are not allowed");
  const { data, info } = await sharp(input)
    .rotate()
    .resize({ width: MAX_DIM, height: MAX_DIM, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer({ resolveWithObject: true });
  return { buffer: data, sha256: createHash("sha256").update(data).digest("hex"), width: info.width, height: info.height, bytes: data.length };
}

export async function processImages(files: Buffer[]): Promise<ProcessedImage[]> {
  if (files.length === 0) throw new Error("Add at least one picture");
  if (files.length > MAX_IMAGES) throw new Error(`Max ${MAX_IMAGES} pictures per post`);
  return Promise.all(files.map(processImage));
}

const dir = () => process.env.UPLOAD_DIR ?? path.join(process.cwd(), "data", "uploads");

/** IPFS via Pinata when configured, otherwise local disk (dev). Returns a reference string. */
export async function storeImage(img: ProcessedImage): Promise<string> {
  const jwt = process.env.PINATA_JWT;
  if (jwt) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(img.buffer)], { type: "image/webp" }), `${img.sha256}.webp`);
    const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: form });
    if (!r.ok) throw new Error(`Pinata upload failed (${r.status})`);
    const j = (await r.json()) as { IpfsHash: string };
    return `ipfs://${j.IpfsHash}`;
  }
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), `${img.sha256}.webp`), img.buffer);
  return `local:${img.sha256}`;
}
export async function readLocalImage(sha: string): Promise<Buffer | null> {
  if (!/^[a-f0-9]{64}$/.test(sha)) return null;
  try { return await readFile(path.join(dir(), `${sha}.webp`)); } catch { return null; }
}
export function imageUrl(ref: string): string {
  if (ref.startsWith("ipfs://")) return `${process.env.IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs/"}${ref.slice(7)}`;
  if (ref.startsWith("local:")) return `/api/img/${ref.slice(6)}`;
  return ref;
}
