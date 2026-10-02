"use client";
import { usePathname } from "next/navigation";
import { TabBar } from "../TabBar";
import { SideNav } from "./SideNav";
import { isBare, hasTabs, hasAside } from "./routes";

/** One shell for every screen: phone = floating tab bar; laptop = left rail (+ right panel on wide screens). */
export function AppShell({ children, aside }: { children: React.ReactNode; aside: React.ReactNode }) {
  const p = usePathname();
  if (isBare(p)) return <>{children}</>;
  const a = hasAside(p);
  return (
    <div className={`has-rail ${a ? "has-aside" : ""}`}>
      <SideNav />
      <main className="pl-[var(--rail)] pr-[var(--aside)]">{children}</main>
      {a && aside}
      {hasTabs(p) && <TabBar />}
    </div>
  );
}
