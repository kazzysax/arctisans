// Which chrome each route gets. One place, so phone tab bar / laptop rail / right panel never disagree.
const BARE = [/^\/$/, /^\/signup/, /^\/welcome/, /^\/setup/];
const NO_TABS = [/^\/hire\//, /^\/create/, /^\/jobs\/[^/]+/, /^\/agents\/new/, /^\/p\//, /^\/requests\//, /^\/settings\/verify/];
const ASIDE = [/^\/discover/, /^\/social/, /^\/search/, /^\/jobs$/, /^\/notifications/, /^\/u\//, /^\/requests/, /^\/p\//];

export const isBare = (p: string) => BARE.some((r) => r.test(p));
export const hasTabs = (p: string) => !isBare(p) && !NO_TABS.some((r) => r.test(p));
export const hasAside = (p: string) => ASIDE.some((r) => r.test(p));

export type NavKey = "home" | "search" | "jobs" | "me" | "activity" | "agents" | "settings" | null;
export function navKey(p: string): NavKey {
  if (p.startsWith("/social") || p.startsWith("/p/") || p.startsWith("/discover")) return "home";
  if (p.startsWith("/search") || p.startsWith("/requests")) return "search";
  if (p.startsWith("/jobs")) return "jobs";
  if (p.startsWith("/u/me") || p === "/u/" || (p.startsWith("/u/") && !p.startsWith("/u/me"))) return "me";
  if (p.startsWith("/notifications")) return "activity";
  if (p.startsWith("/agents")) return "agents";
  if (p.startsWith("/settings")) return "settings";
  return null;
}
