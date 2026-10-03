// Enamel-pin style badge: hairline ring, light-blue enamel when earned, a thin-line glyph in the middle.
import type { BadgeId } from "@/lib/badges";
import { LEAF_OUTLINE, LEAF_STEM } from "./Logo";

const G: Record<BadgeId, React.ReactNode> = {
  "first-job": <path d="M12 6v12M8 10l4-4 4 4" />,
  verified: <path d="M8 12.5l2.7 2.7L16.5 9.5" />,
  "on-time-10": <><circle cx="12" cy="12" r="5.5" /><path d="M12 9v3l2 1.5" /></>,
  "five-star-streak": <path d="M12 6.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L12 15.1 8.6 16.9l.7-3.8-2.8-2.6 3.8-.5z" />,
  "clean-record": <path d="M12 6.5l4.5 5.5-4.5 5.5-4.5-5.5z" />,
  "tipped-10": <><circle cx="12" cy="12" r="5.5" /><path d="M12 9.2v5.6M10.3 10.6c0-.8.8-1.3 1.7-1.3s1.7.5 1.7 1.3-.8 1.1-1.7 1.4-1.7.6-1.7 1.4.8 1.3 1.7 1.3 1.7-.5 1.7-1.3" /></>,
  "hires-agents": <><rect x="7.5" y="9" width="9" height="7" rx="2" /><path d="M12 6.5V9M10 12.5h.01M14 12.5h.01" /></>,
  "repeat-client": <path d="M8 10a4.5 4.5 0 0 1 8 0M16 14a4.5 4.5 0 0 1-8 0M16 7.5V10h-2.5M8 16.5V14h2.5" />,
  early: <g transform="translate(12 11.6) scale(.052)" strokeWidth={26}><path d={LEAF_OUTLINE} /><path d="M0,-80 L0,40 M0,20 L60,-40 M0,20 L-60,-40" /><path d={LEAF_STEM} /></g>,
  "earned-1k": <path d="M7 15.5l3-3 2 2 5-5M14 9.5h3v3" />,
  trusted: <path d="M12 6.5l5 2v3.5c0 3-2.2 5-5 6-2.8-1-5-3-5-6V8.5z" />,
  pro: <><path d="M12 6.5l5 2v3.5c0 3-2.2 5-5 6-2.8-1-5-3-5-6V8.5z" /><path d="M9.8 12.2l1.6 1.6 2.9-3" /></>,
};

// Each earned badge gets its own soft enamel colour.
const TINT: Record<BadgeId, string> = {
  "first-job": "#F4E6BC", verified: "#D2E4F2", "on-time-10": "#D3EADC", "five-star-streak": "#F7DFAE",
  "clean-record": "#CFE7E8", "tipped-10": "#F4D8C8", "hires-agents": "#DED7F1", "repeat-client": "#F1D6E0",
  early: "#cfe3f3", "earned-1k": "#E2E7CC", trusted: "#D8DDF0", pro: "#E6D3F0",
};

export function BadgePin({ id, earned, size = 52 }: { id: BadgeId; earned: boolean; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size }}>
      <span className={`absolute inset-0 rounded-full ${earned ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.8),inset_0_-2px_6px_rgba(20,40,70,0.18),0_6px_16px_-6px_rgba(40,60,90,0.35)]" : "border border-dashed border-line-strong"}`} style={earned ? { background: TINT[id] } : undefined} />
      {earned && <span className="absolute inset-[3px] rounded-full border border-black/15" />}
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
        className={`relative ${earned ? "text-[#0b1a29]" : "text-faint"}`} aria-hidden>{G[id]}</svg>
    </span>
  );
}
