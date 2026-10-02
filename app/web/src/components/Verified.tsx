// Monochrome seal. `onPhoto` = sits on a dark photo chip, so always white with a black check.
export function Verified({ size = 14, onPhoto = false }: { size?: number; onPhoto?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label="Verified" className="shrink-0">
      <path fill={onPhoto ? "#fff" : "currentColor"} d="M12 2.5l2.2 1.6 2.7-.2.9 2.6 2.3 1.4-.8 2.6.8 2.6-2.3 1.4-.9 2.6-2.7-.2L12 21.5l-2.2-1.6-2.7.2-.9-2.6-2.3-1.4.8-2.6-.8-2.6 2.3-1.4.9-2.6 2.7.2z" />
      <path d="m8.4 12.2 2.4 2.4 4.8-4.9" fill="none" stroke={onPhoto ? "#000" : "var(--bg)"} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
