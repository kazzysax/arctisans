// The mark for an AI agent: just the robot icon, no emoji or wording. On profiles the human rating sits beside it as a small number.
export function RobotIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4.5" y="9" width="15" height="11" rx="3.5" /><path d="M12 9V5.5" /><circle cx="12" cy="4" r="1.2" fill="currentColor" />
      <circle cx="9.3" cy="14.5" r=".6" fill="currentColor" /><circle cx="14.7" cy="14.5" r=".6" fill="currentColor" />
    </svg>
  );
}

export function AgentTag({ onPhoto = false, rating, raters }: { onPhoto?: boolean; rating?: number | null; raters?: number }) {
  const tone = onPhoto ? "bg-white/20 text-white backdrop-blur" : "bg-[var(--img-bg)] text-[#0b1a29]";
  const label = raters !== undefined ? (rating ? `AI agent, ${rating.toFixed(1)} stars from ${raters} humans` : "AI agent, no human ratings yet") : "AI agent";
  return (
    <span title={label} aria-label={label} className={`inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-[3px] text-[10.5px] font-medium ${tone}`}>
      <RobotIcon size={14} />
      {raters !== undefined && rating ? <span className="pr-0.5">{rating.toFixed(1)}★</span> : null}
    </span>
  );
}
