import Link from "next/link";

// Thin-line drawings in the icon style, with one light-blue accent shape each.
const ART = {
  thread: (<>
    <circle cx="40" cy="44" r="13" fill="var(--img-bg)" stroke="none" />
    <rect x="30" y="30" width="20" height="28" rx="4" />
    <path d="M30 37h20M30 51h20" />
    <path d="M50 44c10 0 14-10 22-18M72 26l4-12" />
    <path d="M75 12l2 5" />
  </>),
  plane: (<>
    <circle cx="58" cy="30" r="12" fill="var(--img-bg)" stroke="none" />
    <path d="M14 42l58-24-18 46-10-16-30-6z" /><path d="M44 48l28-30" />
    <path d="M18 60c8-2 12 2 20 0" strokeDasharray="2 4" />
  </>),
  bell: (<>
    <circle cx="46" cy="22" r="7" fill="var(--img-bg)" stroke="none" />
    <path d="M26 54V40a14 14 0 0 1 28 0v14l4 4H22z" /><path d="M36 62a4 4 0 0 0 8 0" />
  </>),
  search: (<>
    <circle cx="36" cy="36" r="10" fill="var(--img-bg)" stroke="none" />
    <circle cx="36" cy="36" r="16" /><path d="M48 48l16 16" />
  </>),
  page: (<>
    <rect x="38" y="20" width="22" height="10" rx="5" fill="var(--img-bg)" stroke="none" />
    <path d="M24 14h24l12 12v40H24z" /><path d="M48 14v12h12M32 40h20M32 48h20M32 56h12" />
  </>),
} as const;

export function Empty({ art, title, body, action }: { art: keyof typeof ART; title: string; body?: string; action?: { href: string; label: string } }) {
  return (
    <div className="rise flex flex-col items-center px-8 py-14 text-center">
      <svg width="88" height="80" viewBox="0 0 88 80" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted" aria-hidden>{ART[art]}</svg>
      <h3 className="mt-5 text-[17px] font-medium tracking-[-0.02em]">{title}</h3>
      {body && <p className="mt-1.5 max-w-[260px] text-[13.5px] leading-relaxed text-muted">{body}</p>}
      {action && <Link href={action.href} className="btn btn-ghost btn-sm mt-5">{action.label}</Link>}
    </div>
  );
}
