"use client";
import { useState, useEffect, useCallback, createContext, useContext } from "react";

export type AuthProfile = {
  wallet: string;
  handle: string;
  displayName: string;
  kind: string;
  avatar: string | null;
  cover?: string | null;
  title: string | null;
  verified: boolean;
};

// "new" = signed in (session cookie is valid) but no CV yet.
type AuthState = { status: "loading" } | { status: "out" } | { status: "new" } | { status: "in"; profile: AuthProfile };

const AuthCtx = createContext<AuthState & { refresh?: () => Promise<AuthState> }>({ status: "loading" });

export function useAuth() {
  return useContext(AuthCtx);
}

export function useAuthState(): [AuthState, () => Promise<AuthState>] {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  const refresh = useCallback(async (): Promise<AuthState> => {
    let next: AuthState;
    try {
      const r = await fetch("/api/profile", { credentials: "include", cache: "no-store" });
      next = r.ok ? { status: "in", profile: (await r.json()) as AuthProfile } : { status: r.status === 404 ? "new" : "out" };
    } catch { next = { status: "out" }; }
    setState(next);
    return next;
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load of the signed-in profile
  useEffect(() => { void refresh(); }, [refresh]);
  return [state, refresh];
}

export { AuthCtx };
