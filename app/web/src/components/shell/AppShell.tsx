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
  const [auth, setAuth] = useAuthState();

  // Auth guard: redirect logged-out users away from protected screens.
  useEffect(() => {
    if (auth.status === "loading") return;
    if (auth.status === "out" && !isBare(p)) {
      r.replace("/signup");
    }
    // After signing in, if on setup and already have a profile, go to their CV.
    if (auth.status === "in" && p === "/welcome") {
      r.replace(`/u/${auth.profile.handle}`);
    }
  }, [auth.status, p, r, auth]);

  if (isBare(p)) {
    return (
      <AuthCtx.Provider value={auth}>
        {children}
      </AuthCtx.Provider>
    );
  }

  // Still loading auth → render nothing to avoid flash of wrong screen
  if (auth.status === "loading") return null;
  if (auth.status === "out") return null;

  const a = hasAside(p);
  return (
    <AuthCtx.Provider value={auth}>
      <div className={`has-rail ${a ? "has-aside" : ""}`}>
        <SideNav />
        <main className="pl-[var(--rail)] pr-[var(--aside)]">{children}</main>
        {a && aside}
        {hasTabs(p) && <TabBar />}
      </div>
    </AuthCtx.Provider>
  );
}
