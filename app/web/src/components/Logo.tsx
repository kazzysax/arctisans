// Arctisans mark: a line-drawn maple leaf (white on dark, black on light via currentColor).
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-label="Arctisans">
      <g transform="translate(16 16) scale(.14) translate(0 -2)"><path d="M0,-100 L11,-70 L25,-78 L21,-50 L46,-64 L41,-40 L72,-54 L58,-24 L86,-6 L60,8 L68,34 L36,24 L9,38 L-9,38 L-36,24 L-68,34 L-60,8 L-86,-6 L-58,-24 L-72,-54 L-41,-40 L-46,-64 L-21,-50 L-25,-78 L-11,-70 Z" fill="none" stroke="currentColor" strokeWidth="9" strokeLinejoin="round"/><path d="M0,-92 L0,44 M0,22 L62,-46 M0,22 L-62,-46 M0,22 L74,-5 M0,22 L-74,-5 M0,22 L40,-55 M0,22 L-40,-55 M0,30 L58,29 M0,30 L-58,29 M0,-58 L12,-72 M0,-36 L20,-52 M0,-58 L-12,-72 M0,-36 L-20,-52" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"/><path d="M0,36 L0,104" stroke="currentColor" strokeWidth="12" strokeLinecap="round"/></g>
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
