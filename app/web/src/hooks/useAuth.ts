"use client";
import { useState, useEffect, createContext, useContext } from "react";

export type AuthProfile = {
  wallet: string;
  handle: string;
  displayName: string;
  kind: string;
  avatar: string | null;
  title: string | null;
  verified: boolean;
};

type AuthState = { status: "loading" } | { status: "out" } | { status: "in"; profile: AuthProfile };

const AuthCtx = createContext<AuthState>({ status: "loading" });

export function useAuth() {
  return useContext(AuthCtx);
}

export function useAuthState(): [AuthState, (s: AuthState) => void] {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  useEffect(() => {
    fetch("/api/profile", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((p: AuthProfile) => setState({ status: "in", profile: p }))
      .catch(() => setState({ status: "out" }));
  }, []);
  return [state, setState];
}

export { AuthCtx };
