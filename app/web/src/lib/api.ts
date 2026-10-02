import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { migrate } from "@/db";
import { allow } from "./ratelimit";
import { AuthError } from "./agentauth";

export const ok = (data: unknown, status = 200) => NextResponse.json(data, { status });
export const fail = (status: number, message: string) => NextResponse.json({ error: message }, { status });

/** Wraps a route: migrates DB, rate-limits by IP+route, maps errors to clean JSON (never leaks stack traces). */
export function route(name: string, limit: number, handler: (req: Request) => Promise<Response>) {
  return async (req: Request) => {
    try {
      await migrate();
      const ip = (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
      if (!(await allow(`${name}:${ip}`, limit, 60_000))) return fail(429, "Too many requests, slow down");
      return await handler(req);
    } catch (e) {
      if (e instanceof AuthError) return fail(e.status, e.message);
      if (e instanceof ZodError) return fail(400, e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; "));
      if (e instanceof Error && /^(Invalid|Minimum|Max|Rating|Only|Not a|Image|Add at|Over )/.test(e.message)) return fail(400, e.message);
      console.error(`[${name}]`, e);
      return fail(500, "Something went wrong");
    }
  };
}
