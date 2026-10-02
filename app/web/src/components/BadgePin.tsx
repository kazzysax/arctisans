// Enamel-pin style badge: hairline ring, light-blue enamel when earned, a thin-line glyph in the middle.
import type { BadgeId } from "@/lib/badges";

const G: Record<BadgeId, React.ReactNode> = {
  "first-job": <path d="M12 6v12M8 10l4-4 4 4" />,
  verified: <path d="M8 12.5l2.7 2.7L16.5 9.5" />,
  "on-time-10": <><circle cx="12" cy="12" r="5.5" /><path d="M12 9v3l2 1.5" /></>,
  "five-star-streak": <path d="M12 6.5l1.7 3.5 3.8.5-2.8 2.6.7 3.8L12 15.1 8.6 16.9l.7-3.8-2.8-2.6 3.8-.5z" />,
  "clean-record": <path d="M12 6.5l4.5 5.5-4.5 5.5-4.5-5.5z" />,
  "tipped-10": <><circle cx="12" cy="12" r="5.5" /><path d="M12 9.2v5.6M10.3 10.6c0-.8.8-1.3 1.7-1.3s1.7.5 1.7 1.3-.8 1.1-1.7 1.4-1.7.6-1.7 1.4.8 1.3 1.7 1.3 1.7-.5 1.7-1.3" /></>,
  "hires-agents": <><rect x="7.5" y="9" width="9" height="7" rx="2" /><path d="M12 6.5V9M10 12.5h.01M14 12.5h.01" /></>,
  "repeat-client": <path d="M8 10a4.5 4.5 0 0 1 8 0M16 14a4.5 4.5 0 0 1-8 0M16 7.5V10h-2.5M8 16.5V14h2.5" />,
  early: <path d="M7 15a5 5 0 0 1 10 0M12 15v.01" />,
  "earned-1k": <path d="M7 15.5l3-3 2 2 5-5M14 9.5h3v3" />,
  trusted: <path d="M12 6.5l5 2v3.5c0 3-2.2 5-5 6-2.8-1-5-3-5-6V8.5z" />,
  pro: <><path d="M12 6.5l5 2v3.5c0 3-2.2 5-5 6-2.8-1-5-3-5-6V8.5z" /><path d="M9.8 12.2l1.6 1.6 2.9-3" /></>,
};

export function BadgePin({ id, earned, size = 52 }: { id: BadgeId; earned: boolean; size?: number }) {
  return (
    <span className="relative grid shrink-0 place-items-center rounded-full" style={{ width: size, height: size }}>
      <span className={`absolute inset-0 rounded-full ${earned ? "bg-[var(--img-bg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-2px_6px_rgba(20,60,100,0.25),0_6px_18px_-6px_rgba(120,170,215,0.55)]" : "border border-dashed border-line-strong"}`} />
      {earned && <span className="absolute inset-[3px] rounded-full border border-black/15" />}
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"
        className={`relative ${earned ? "text-[#0b1a29]" : "text-faint"}`} aria-hidden>{G[id]}</svg>
    </span>
  );
}
