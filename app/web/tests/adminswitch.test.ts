import { describe, it, expect, beforeAll } from "vitest";
import { issueSession, issueAdminMark, readAdminMark, readSession, realAdmin } from "@/lib/session";

const ADMIN = "0x579f0c20a52035c150c8886f11ab6d88b513f719", OFFICIAL = "0x3edfd25cc190023ee62c4bec6a3d821f5339a189", RANDO = "0x1111111111111111111111111111111111111111";
const req = (cookie: string) => new Request("http://x/", { headers: { cookie } });
beforeAll(() => { process.env.APP_SECRET = "s".repeat(40); process.env.ADMIN_WALLETS = ADMIN; });

describe("admin switch", () => {
  it("an admin's own session is the real admin", () => {
    expect(realAdmin(req(`arc_session=${issueSession(ADMIN)}`))).toBe(ADMIN);
  });
  it("switched into the official profile, the admin mark proves who is behind it", () => {
    expect(realAdmin(req(`arc_session=${issueSession(OFFICIAL)}; arc_admin=${issueAdminMark(ADMIN)}`))).toBe(ADMIN);
  });
  it("a normal user is never an admin", () => {
    expect(realAdmin(req(`arc_session=${issueSession(RANDO)}`))).toBeNull();
  });
  it("a normal user cannot forge an admin mark for a non-admin wallet", () => {
    expect(realAdmin(req(`arc_session=${issueSession(RANDO)}; arc_admin=${issueAdminMark(RANDO)}`))).toBeNull();
  });
  it("a tampered mark is rejected", () => {
    const m = issueAdminMark(ADMIN), [b, s] = m.split(".");
    const forged = `${Buffer.from(JSON.stringify({ a: RANDO, exp: Date.now() + 1e9 })).toString("base64url")}.${s}`;
    expect(readAdminMark(`arc_admin=${forged}`)).toBeNull();
    expect(readAdminMark(`arc_admin=${b}.${s}`)).toMatchObject({ admin: ADMIN });
  });
  it("the admin mark can never be used as a login session", () => {
    expect(readSession(`arc_session=${issueAdminMark(ADMIN)}`)).toBeNull();
  });
  it("a mark with no session does nothing", () => {
    expect(realAdmin(req(`arc_admin=${issueAdminMark(ADMIN)}`))).toBeNull();
  });
});
