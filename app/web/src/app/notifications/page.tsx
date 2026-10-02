"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { TopBar } from "@/components/ui";

const GLYPH: Record<string, string> = { tip: "$", paid: "◎", review: "★", follow: "+", released: "↗", job: "⚡" };

type NotifData = {
  who?: string;
  name?: string;
  avatar?: string;
  text?: string;
  jobId?: string;
};

type Notif = {
  id: string;
  kind: string;
  data: NotifData;
  read: boolean;
  createdAt: number;
};

function ago(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function notifHref(n: Notif): string {
  if (n.kind === "follow") return `/u/${n.data.who ?? ""}`;
  if (n.data.jobId) return `/jobs/${n.data.jobId}`;
  return "/jobs";
}

export default function Notifications() {
  const [items, setItems] = useState<Notif[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/notifications", { credentials: "include" })
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((j: { items?: Notif[] }) => {
        setItems(j.items ?? []);
        // Mark all as read
        return fetch("/api/notifications", {
          method: "POST", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ all: true }),
        });
      })
      .catch(() => setError("Could not load notifications"));
  }, []);

  return (
    <main className="mx-auto min-h-dvh max-w-[560px] pb-10">
      <TopBar back="/social" title="Activity" />
      <div className="px-5">
        {error && <p className="mt-4 text-[14px] text-muted">{error}</p>}

        {items === null && !error && (
          <div className="mt-4 flex flex-col gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex animate-pulse items-center gap-3 py-3">
                <div className="h-11 w-11 rounded-[14px] bg-line" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-3/4 rounded bg-line" />
                  <div className="h-3 w-1/2 rounded bg-line" />
                </div>
              </div>
            ))}
          </div>
        )}

        {items !== null && items.length === 0 && (
          <p className="mt-8 text-center text-[14px] text-muted">No activity yet.</p>
        )}

        {items !== null && items.length > 0 && (
          <>
            <div className="label mt-2">Recent</div>
            {items.map((n, i) => (
              <Link key={n.id} href={notifHref(n)} className={`rise press flex items-center gap-3 py-3.5 ${i ? "border-t border-line" : ""} ${!n.read ? "font-[450]" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
                <div className="relative">
                  {n.data.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={n.data.avatar} alt="" className="h-11 w-11 rounded-[14px] object-cover" />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-bg-2 text-[18px] text-muted">{GLYPH[n.kind] ?? "·"}</div>
                  )}
                  <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-fg text-[10px] font-semibold text-[var(--bg)] ring-2 ring-[var(--bg)]">{GLYPH[n.kind] ?? "·"}</span>
                </div>
                <p className="flex-1 text-[14px] leading-snug">
                  <span className="font-medium">{n.data.name ?? n.data.who ?? "Someone"}</span>{" "}
                  <span className="text-muted">{n.data.text ?? n.kind}</span>
                </p>
                <span className="text-[12px] text-faint">{ago(n.createdAt)}</span>
              </Link>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
