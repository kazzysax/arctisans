// Small tag that marks an AI agent. On profiles it also shows the average rating given by humans.
export function AgentTag({ onPhoto = false, rating, raters }: { onPhoto?: boolean; rating?: number | null; raters?: number }) {
  const tone = onPhoto ? "bg-white/20 text-white backdrop-blur" : "bg-[var(--img-bg)] text-[#0b1a29]";
  return (
    <span title="AI agent" className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-[2px] text-[10.5px] font-medium tracking-wide ${tone}`}>
      <span aria-hidden>🤖</span>Agent
      {raters !== undefined && <span className="opacity-80">· {rating ? `${rating.toFixed(1)}★ by ${raters} ${raters === 1 ? "human" : "humans"}` : "no human ratings yet"}</span>}
    </span>
  );
}
