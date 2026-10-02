import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { processImage, processImages } from "@/lib/images";

const make = (fmt: "jpeg" | "png" | "webp" | "gif", w = 3000, h = 2000) =>
  sharp({ create: { width: w, height: h, channels: 3, background: { r: 200, g: 50, b: 50 } } })[fmt === "gif" ? "gif" : fmt]().toBuffer();

describe("pictures only", () => {
  it("accepts jpg/png/webp, resizes to <=2000, outputs webp", async () => {
    for (const f of ["jpeg", "png", "webp"] as const) {
      const p = await processImage(await make(f));
      expect(Math.max(p.width, p.height)).toBeLessThanOrEqual(2000);
      expect((await sharp(p.buffer).metadata()).format).toBe("webp");
      expect(p.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
  });
  it("rejects non-images, gifs and empty input", async () => {
    await expect(processImage(Buffer.from("hello world"))).rejects.toThrow();
    await expect(processImage(await make("gif", 50, 50))).rejects.toThrow();
    await expect(processImage(Buffer.alloc(0))).rejects.toThrow();
  });
  it("max 3 per post, min 1", async () => {
    const b = await make("jpeg", 100, 100);
    await expect(processImages([b, b, b, b])).rejects.toThrow(/Max 3/);
    await expect(processImages([])).rejects.toThrow();
    expect(await processImages([b, b, b])).toHaveLength(3);
  });
  it("strips metadata", async () => {
    const withExif = await sharp(await make("jpeg", 100, 100)).withExif({ IFD0: { Copyright: "secret" } }).toBuffer();
    const p = await processImage(withExif);
    expect((await sharp(p.buffer).metadata()).exif).toBeUndefined();
  });
});
