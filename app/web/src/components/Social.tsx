// Thin-line brand marks for the CV link row (monochrome).
const S = ({ children, size = 18 }: { children: React.ReactNode; size?: number }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{children}</svg>;
export const SocialIcon = ({ kind, size = 18 }: { kind: string; size?: number }) => {
  switch (kind) {
    case "linkedin": return <S size={size}><rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M8 10.5V16M8 7.6v.1M11.5 16v-3.2a2.3 2.3 0 0 1 4.5 0V16M11.5 10.5V16" /></S>;
    case "x": return <S size={size}><path d="M4.5 4.5h4.2l10.8 15h-4.2z" /><path d="M19 4.5l-5.8 6.5M5 19.5l5.8-6.5" /></S>;
    case "instagram": return <S size={size}><rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="3.8" /><path d="M17 7v.1" /></S>;
    case "tiktok": return <S size={size}><path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.5 2.3 2.2 3.8 4.5 4" /></S>;
    case "github": return <S size={size}><path d="M9 19c-4 1.3-4-2-5.5-2.5M14.5 21v-3.2c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.7 4.7 0 0 0-1.3-3.2 4.3 4.3 0 0 0-.1-3.2s-1-.3-3.4 1.3a11.5 11.5 0 0 0-6 0C6.3 3.1 5.3 3.4 5.3 3.4a4.3 4.3 0 0 0-.1 3.2A4.7 4.7 0 0 0 3.9 9.8c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" /></S>;
    default: return <S size={size}><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c2.5 2.6 3.5 5.5 3.5 8.5s-1 5.9-3.5 8.5c-2.5-2.6-3.5-5.5-3.5-8.5s1-5.9 3.5-8.5z" /></S>;
  }
};
