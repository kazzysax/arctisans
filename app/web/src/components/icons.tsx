// Thin-line icons (1.5px), drawn to one grid so they sit evenly in the tab bar.
type P = { size?: number; className?: string };
const S = ({ size = 22, className, children }: P & { children: React.ReactNode }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    {children}
  </svg>
);
export const Home = (p: P) => <S {...p}><path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></S>;
export const Search = (p: P) => <S {...p}><circle cx="11" cy="11" r="6.5" /><path d="m20 20-4.2-4.2" /></S>;
export const Briefcase = (p: P) => <S {...p}><rect x="3.5" y="7" width="17" height="12.5" rx="2.5" /><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17" /></S>;
export const Bell = (p: P) => <S {...p}><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 1.5H5z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></S>;
export const Plus = (p: P) => <S {...p}><path d="M12 5v14M5 12h14" /></S>;
export const Heart = (p: P) => <S {...p}><path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" /></S>;
export const Coin = (p: P) => <S {...p}><circle cx="12" cy="12" r="8" /><path d="M14.5 9.3c-.5-.8-1.4-1.3-2.5-1.3-1.5 0-2.5.8-2.5 2s1 1.6 2.5 2 2.5.8 2.5 2-1 2-2.5 2c-1.1 0-2-.5-2.5-1.3M12 6.5v1.5M12 16v1.5" /></S>;
export const Check = (p: P) => <S {...p}><path d="m5 12.5 4.5 4.5L19 7.5" /></S>;
export const Spark = (p: P) => <S {...p}><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4M6 6l2.6 2.6M15.4 15.4 18 18M6 18l2.6-2.6M15.4 8.6 18 6" /></S>;
export const Arrow = (p: P) => <S {...p}><path d="M5 12h14M13 6l6 6-6 6" /></S>;
export const Dots = (p: P) => <S {...p}><circle cx="5.5" cy="12" r=".9" fill="currentColor" /><circle cx="12" cy="12" r=".9" fill="currentColor" /><circle cx="18.5" cy="12" r=".9" fill="currentColor" /></S>;
