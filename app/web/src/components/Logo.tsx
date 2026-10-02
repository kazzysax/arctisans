// Arctisans mark: an arc over a point. The arc is Arc; the point is the person.
export function Mark({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-label="Arctisans">
      <path d="M7 22a9 9 0 0 1 18 0" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
      <circle cx="16" cy="22" r="2.4" fill="currentColor" />
    </svg>
  );
}
export function LogoTile({ size = 76 }: { size?: number }) {
  return (
    <div className="grid place-items-center rounded-[26%] bg-white text-black shadow-[0_20px_60px_-10px_rgba(255,255,255,0.25)]" style={{ width: size, height: size }}>
      <Mark size={size * 0.56} />
    </div>
  );
}
