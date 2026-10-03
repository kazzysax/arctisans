"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TabBar } from "../TabBar";
import { SideNav } from "./SideNav";
import { isBare, hasTabs, hasAside } from "./routes";
import { AuthCtx, useAuthState } from "@/hooks/useAuth";

/** One shell for every screen: phone = floating tab bar; laptop = left rail (+ right panel on wide screens). */
export function AppShell({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  const p = usePathname();
  const r = useRouter();
  const [auth, refresh] = useAuthState();
  const ctx = { ...auth, refresh };

  // Auth guard. Signed out -> sign in. Signed in without a CV -> setup. Signed in on the intro -> home.
  // The status may be stale (it was read before signing in), so check again before sending anyone away.
  useEffect(() => {
    if (auth.status === "loading" || auth.status === "in" || isBare(p)) return;
    let live = true;
    refresh().then((s) => {
      if (!live) return;
      if (s.status === "out") r.replace("/signup");
      if (s.status === "new") r.replace("/setup");
    });
    return () => { live = false; };
  }, [auth.status, p, r, refresh]);

  if (isBare(p)) {
    return (
      <AuthCtx.Provider value={ctx}>
        {children}
      </AuthCtx.Provider>
    );
  }

  // Still loading auth → render nothing to avoid flash of wrong screen
  if (auth.status === "loading") return null;
  if (auth.status === "out" || auth.status === "new") return null;

  const a = hasAside(p);
  return (
    <AuthCtx.Provider value={ctx}>
      <div className={`has-rail ${a ? "has-aside" : ""}`}>
        <SideNav />
        <main className="pl-[var(--rail)] pr-[var(--aside)]">{children}</main>
        {a && aside}
        {hasTabs(p) && <TabBar me={auth.status === "in" ? auth.profile.avatar : null} />}
      </div>
    </AuthCtx.Provider>
  );
}
