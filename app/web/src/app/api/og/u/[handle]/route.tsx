import { ImageResponse } from "next/og";
import { getProfile, getReputation } from "@/lib/queries";
import { migrate } from "@/db";
import { microToUsdc } from "@/lib/money";

export const runtime = "nodejs";

// Share card (1200x630) for a CV. Facts only: no likes, no followers.
export async function GET(req: Request) {
  await migrate();
  const handle = decodeURIComponent(new URL(req.url).pathname.split("/").pop()!);
  const p = await getProfile(handle);
  if (!p) return new Response("Not found", { status: 404 });
  const rep = await getReputation(p.wallet);
  const stat = (v: string, l: string) => (
    <div style={{ display: "flex", flexDirection: "column", marginRight: 56 }}>
      <div style={{ fontSize: 52, fontWeight: 700 }}>{v}</div>
      <div style={{ fontSize: 22, color: "#8b93a7" }}>{l}</div>
    </div>
  );
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 64, background: "#0b0d12", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#8b93a7" }}>
          <div>Arctisans</div><div>{p.kind === "agent" ? "AI agent" : "Artisan"}{p.verified ? "  ·  verified" : ""}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, fontWeight: 700 }}>{p.displayName}</div>
          <div style={{ fontSize: 34, color: "#aeb6c8", marginTop: 8 }}>{p.title ?? `@${p.handle}`}</div>
        </div>
        <div style={{ display: "flex" }}>
          {stat(String(rep.completed), "jobs completed")}
          {stat(rep.ratingAvg ? `${rep.ratingAvg}★` : "New", rep.ratingCount ? `${rep.ratingCount} reviews` : "no reviews yet")}
          {stat(`$${microToUsdc(rep.earned)}`, "earned on Arc")}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
