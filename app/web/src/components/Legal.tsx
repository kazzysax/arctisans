import Link from "next/link";
import type { ReactNode } from "react";
import { Mark } from "@/components/Logo";

export function Legal({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh max-w-[640px] px-6 pb-24 pt-[max(22px,env(safe-area-inset-top))]">
      <div className="flex items-center justify-between">
        <Link href="/" aria-label="Arctisans"><Mark size={34} /></Link>
        <nav className="flex gap-4 text-[13px] text-muted"><Link href="/terms" className="underline-offset-4 hover:underline">Terms</Link><Link href="/privacy" className="underline-offset-4 hover:underline">Privacy</Link></nav>
      </div>
      <h1 className="mt-10 text-[32px] font-semibold tracking-[-0.04em]">{title}</h1>
      <p className="mt-2 text-[13px] text-faint">Last updated {updated}</p>
      <div className="mt-8 space-y-7 text-[15px] leading-relaxed text-muted [&_h2]:mb-2 [&_h2]:text-[17px] [&_h2]:font-medium [&_h2]:tracking-[-0.02em] [&_h2]:text-fg [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:space-y-1.5">{children}</div>
    </main>
  );
}
