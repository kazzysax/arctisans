// Animated line illustrations for each craft. Ink lines on the light-blue image tile (house rule:
// images sit on light blue). Each loops one small motion; motion stops for prefers-reduced-motion.
import type { CraftId } from "@/lib/crafts";

const ink = "#0f2236";
const S = ({ children }: { children: React.ReactNode }) => (
  <svg viewBox="0 0 160 120" className="craft-art h-full w-full" fill="none" stroke={ink} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {children}
  </svg>
);

export function CraftArt({ id }: { id: CraftId }) {
  switch (id) {
    case "writing": return (
      <S>
        <rect x="38" y="20" width="70" height="86" rx="6" fill="#fff" />
        <path className="ca-write" d="M50 40h46M50 52h40M50 64h44M50 76h30" pathLength={1} />
        <g className="ca-pen"><path d="M112 30l14-14 8 8-14 14z" fill="#fff" /><path d="M112 30l-4 12 12-4" /></g>
      </S>);
    case "design": return (
      <S>
        <circle cx="62" cy="62" r="26" fill="#fff" />
        <rect x="74" y="42" width="44" height="44" rx="6" className="ca-spin" style={{ transformOrigin: "96px 64px" }} />
        <path d="M40 98h80" />
        <circle cx="62" cy="62" r="4" fill={ink} className="ca-pulse" />
      </S>);
    case "development": return (
      <S>
        <rect x="26" y="24" width="108" height="72" rx="8" fill="#fff" />
        <path d="M26 38h108" /><circle cx="36" cy="31" r="1.5" fill={ink} /><circle cx="43" cy="31" r="1.5" fill={ink} />
        <path d="M52 56l-10 10 10 10M108 56l10 10-10 10" />
        <path d="M66 72h22" className="ca-type" pathLength={1} /><rect x="90" y="66" width="3" height="11" fill={ink} className="ca-caret" stroke="none" />
      </S>);
    case "video": return (
      <S>
        <rect x="30" y="30" width="80" height="60" rx="8" fill="#fff" />
        <path d="M110 50l22-12v44l-22-12z" fill="#fff" />
        <path d="M60 48l20 12-20 12z" fill={ink} className="ca-pulse" />
        <path d="M30 100h80" /><circle cx="44" cy="100" r="4" fill="#fff" className="ca-scrub" />
      </S>);
    case "illustration": return (
      <S>
        <rect x="28" y="22" width="104" height="78" rx="8" fill="#fff" />
        <path className="ca-write" d="M44 82c10-30 24-44 36-30s20 4 26-10 14-10 14-10" pathLength={1} />
        <circle cx="112" cy="40" r="7" className="ca-pulse" />
      </S>);
    case "community": return (
      <S>
        <circle cx="80" cy="54" r="14" fill="#fff" /><path d="M58 96c2-14 12-22 22-22s20 8 22 22" fill="#fff" />
        <circle cx="40" cy="62" r="10" fill="#fff" className="ca-bob" /><circle cx="120" cy="62" r="10" fill="#fff" className="ca-bob2" />
        <path d="M80 26v-6M66 30l-4-5M94 30l4-5" className="ca-pulse" />
      </S>);
    case "research": return (
      <S>
        <rect x="30" y="24" width="72" height="80" rx="6" fill="#fff" />
        <rect x="42" y="70" width="10" height="20" fill={ink} stroke="none" className="ca-bar1" />
        <rect x="58" y="58" width="10" height="32" fill={ink} stroke="none" className="ca-bar2" />
        <rect x="74" y="46" width="10" height="44" fill={ink} stroke="none" className="ca-bar3" />
        <g className="ca-glass"><circle cx="112" cy="56" r="16" fill="#fff" /><path d="M123 68l14 14" /></g>
      </S>);
    case "moderation": return (
      <S>
        <rect x="24" y="30" width="62" height="40" rx="12" fill="#fff" /><path d="M38 70l-6 12 16-12" fill="#fff" />
        <path d="M38 46h34M38 56h22" />
        <g className="ca-bob"><path d="M112 28l22 8v16c0 14-10 23-22 28-12-5-22-14-22-28V36z" fill="#fff" /><path d="M103 53l7 7 13-14" className="ca-write" pathLength={1} /></g>
      </S>);
    case "marketing": return (
      <S>
        <path d="M34 52v18h14l40 20V32L48 52z" fill="#fff" /><path d="M48 70l6 22h12l-6-22" fill="#fff" />
        <path d="M104 44c8 6 8 26 0 32" className="ca-pulse" /><path d="M116 34c16 12 16 40 0 52" className="ca-pulse" style={{ animationDelay: ".3s" }} />
      </S>);
    case "translation": return (
      <S>
        <rect x="22" y="26" width="64" height="46" rx="12" fill="#fff" className="ca-bob" />
        <path d="M40 60l10-24 10 24M44 52h12" className="ca-bob" />
        <rect x="74" y="48" width="64" height="46" rx="12" fill="#fff" className="ca-bob2" />
        <path d="M92 64h28M106 60v-4M96 64c2 10 10 16 20 18M116 64c-2 8-8 14-18 18" className="ca-bob2" />
      </S>);
  }
}
