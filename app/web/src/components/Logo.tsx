// Arctisans mark: a line-drawn maple leaf (white on dark, black on light via currentColor).
export const LEAF_OUTLINE = "M0,-100 L14,-70 L32,-78 L27,-50 L59,-64 L52,-40 L92,-54 L74,-24 L110,-6 L77,8 L87,34 L46,24 L12,38 L-12,38 L-46,24 L-87,34 L-77,8 L-110,-6 L-74,-24 L-92,-54 L-52,-40 L-59,-64 L-27,-50 L-32,-78 L-14,-70 Z";
export const LEAF_VEINS = "M0,-92 L0,44 M0,22 L79,-46 M0,22 L-79,-46 M0,22 L95,-5 M0,22 L-95,-5 M0,22 L51,-55 M0,22 L-51,-55 M0,30 L75,29 M0,30 L-75,29 M0,-58 L15,-72 M0,-36 L26,-52 M0,-58 L-15,-72 M0,-36 L-26,-52";
export const LEAF_STEM = "M0,36 L0,104";

export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-label="Arctisans">
      <g transform="translate(16 16) scale(.13) translate(0 -2)"><path d={LEAF_OUTLINE} fill="none" strokeWidth="9" stroke="currentColor" strokeLinejoin="round"/><path d={LEAF_VEINS} fill="none" strokeWidth="6" stroke="currentColor" strokeLinecap="round"/><path d={LEAF_STEM} strokeWidth="12" stroke="currentColor" strokeLinecap="round"/></g>
    </svg>
  );
}

/** The leaf drawing itself: outline traces, veins grow out, stem drops, then it breathes. Used for every loading state.
 *  progress (0..1) drives it by hand (pull-to-refresh); without it, it loops. */
export function LeafLoader({ size = 64, progress, className = "" }: { size?: number; progress?: number; className?: string }) {
  const manual = progress !== undefined;
  const p = Math.max(0, Math.min(1, progress ?? 0));
  const seg = (a: number, b: number) => (manual ? { strokeDashoffset: 1 - Math.max(0, Math.min(1, (p - a) / (b - a))) } : undefined);
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={`leaf-loader ${manual ? "" : "leaf-auto"} ${className}`} aria-label="Loading" role="img">
      <g transform="translate(16 16) scale(.13) translate(0 -2)" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path className="ll-out" d={LEAF_OUTLINE} strokeWidth="9" pathLength={1} style={seg(0, .6)} />
        <path className="ll-vein" d={LEAF_VEINS} strokeWidth="6" pathLength={1} style={seg(.45, .9)} />
        <path className="ll-stem" d={LEAF_STEM} strokeWidth="12" pathLength={1} style={seg(.8, 1)} />
      </g>
    </svg>
  );
}

export function LogoTile({ size = 76 }: { size?: number }) {
  return (
    <div className="grid place-items-center rounded-[26%] bg-white text-black shadow-[0_20px_60px_-10px_rgba(255,255,255,0.25)]" style={{ width: size, height: size }}>
      <Mark size={size * 0.7} />
    </div>
  );
}
