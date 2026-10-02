"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function Back({ href }: { href?: string }) {
  const r = useRouter();
  const cls = "press grid h-10 w-10 place-items-center rounded-full glass text-fg";
  const icon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>;
  return href ? <Link href={href} aria-label="Back" className={cls}>{icon}</Link> : <button aria-label="Back" onClick={() => r.back()} className={cls}>{icon}</button>;
}

export function TopBar({ title, right, back }: { title?: string; right?: React.ReactNode; back?: string | true }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-[var(--bg)]/80 px-5 pb-3 pt-[max(16px,env(safe-area-inset-top))] backdrop-blur-xl">
      {back && <Back href={back === true ? undefined : back} />}
      <h1 className="flex-1 truncate text-[17px] font-medium tracking-[-0.02em]">{title}</h1>
      {right}
    </header>
  );
}

/** Bottom sheet with a hairline handle; closes on backdrop tap or Escape. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center lg:items-center lg:pl-[var(--rail)] lg:pr-[var(--aside)]">
      <button aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" style={{ animation: "fade 220ms both" }} />
      <div role="dialog" aria-modal className="sheet-panel relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto rounded-t-[32px] border border-line bg-bg-2 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 lg:rounded-[32px] lg:pb-6">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" />
        {title && <h3 className="mb-4 text-[19px] font-medium tracking-[-0.02em]">{title}</h3>}
        {children}
      </div>
    </div>
  );
}

export function Stat({ value, label }: { value: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="num text-[22px] font-medium">{value}</div>
      <div className="text-[11px] uppercase tracking-[0.14em] text-faint">{label}</div>
    </div>
  );
}

export function Page({ children, tabs = false, className = "" }: { children: React.ReactNode; tabs?: boolean; className?: string }) {
  return <div className={`relative mx-auto min-h-dvh max-w-[480px] ${tabs ? "pb-24" : "pb-10"} ${className}`}>{children}</div>;
}
