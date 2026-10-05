import { NextResponse } from "next/server";
import { finishOAuth } from "@/lib/xlink";

// X sends the user back here after they approve. The state ties it to the Arctisans session that started it.
export async function GET(req: Request) {
  const u = new URL(req.url), base = process.env.APP_URL ?? u.origin;
  const state = u.searchParams.get("state"), code = u.searchParams.get("code");
  if (!state || !code) return NextResponse.redirect(`${base}/settings/x?error=${encodeURIComponent(u.searchParams.get("error") ?? "cancelled")}`);
  try {
    const r = await finishOAuth(state, code);
    return NextResponse.redirect(`${base}/settings/x?${r.purpose === "bot" ? "bot" : "linked"}=${encodeURIComponent(r.username)}`);
  } catch (e) {
    return NextResponse.redirect(`${base}/settings/x?error=${encodeURIComponent((e as Error).message.slice(0, 120))}`);
  }
}
