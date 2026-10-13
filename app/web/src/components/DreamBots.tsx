"use client";
// Arcdreams crew: three little bots with dot eyes on a dark visor. Each has its own silhouette
// (Mochi: soft square with a bobble antenna, Scout: round with a periscope lens, Bolt: tall capsule with a spark).

export type BotKey = "mochi" | "scout" | "bolt";

export const BOT_LOOK: Record<BotKey, { body: string; shade: string; glow: string }> = {
  mochi: { body: "#ffb98a", shade: "#f08f5a", glow: "#fff4d6" },
  scout: { body: "#9cc8ff", shade: "#6c9ff0", glow: "#e6fbff" },
  bolt: { body: "#a8e6a1", shade: "#6fc46a", glow: "#f2ffe0" },
};

const CSS = `
@keyframes db-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5%)}}
@keyframes db-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.12)}}
@keyframes db-look{0%,40%,100%{transform:translateX(0)}50%,85%{transform:translateX(7%)}}
@keyframes db-talk{0%,100%{transform:scaleX(.55)}50%{transform:scaleX(1)}}
@keyframes db-ant{0%,100%{transform:rotate(-8deg)}50%{transform:rotate(8deg)}}
@keyframes db-spark{0%,100%{opacity:.35}50%{opacity:1}}
.db-bob{animation:db-bob 3.2s ease-in-out infinite;transform-box:fill-box}
.db-blink{animation:db-blink 4.6s infinite;transform-origin:center;transform-box:fill-box}
.db-look{animation:db-look 5.5s ease-in-out infinite;transform-box:fill-box}
.db-talk{animation:db-talk .32s ease-in-out infinite;transform-origin:center;transform-box:fill-box}
.db-ant{animation:db-ant 2.4s ease-in-out infinite;transform-origin:50% 100%;transform-box:fill-box}
.db-spark{animation:db-spark 1.1s ease-in-out infinite}
@media (prefers-reduced-motion:reduce){.db-bob,.db-blink,.db-look,.db-talk,.db-ant,.db-spark{animation:none}}
`;
export const BotStyles = () => <style>{CSS}</style>;

export function Bot({ k, size = 96, talking = false, still = false, delay = 0 }: { k: BotKey; size?: number; talking?: boolean; still?: boolean; delay?: number }) {
  const c = BOT_LOOK[k];
  const id = `db-${k}`;
  const anim = (cls: string) => (still ? undefined : cls);
  const ad = { animationDelay: `${delay}ms` };
  const eyes = (cx1: number, cx2: number, cy: number, r = 5.2) => (
    <g className={anim("db-look")} style={ad}>
      <g className={anim("db-blink")} style={ad}>
        <ellipse cx={cx1} cy={cy} rx={r} ry={r * 1.25} fill={c.glow} />
        <ellipse cx={cx2} cy={cy} rx={r} ry={r * 1.25} fill={c.glow} />
      </g>
    </g>
  );
  const mouth = (cx: number, cy: number) => talking
    ? <rect className={anim("db-talk")} x={cx - 7} y={cy - 2} width={14} height={4.5} rx={2.25} fill={c.glow} />
    : <path d={`M${cx - 6} ${cy - 1} q6 5 12 0`} stroke={c.glow} strokeWidth={2.6} fill="none" strokeLinecap="round" />;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden style={{ overflow: "visible", display: "block" }}>
      <defs>
        <linearGradient id={`${id}-b`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={c.body} /><stop offset="1" stopColor={c.shade} /></linearGradient>
        <linearGradient id={`${id}-v`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#23262e" /><stop offset="1" stopColor="#0c0d11" /></linearGradient>
      </defs>
      <ellipse cx="60" cy="113" rx="30" ry="5" fill="#000" opacity=".22" />
      <g className={anim("db-bob")} style={ad}>
        {k === "mochi" && <>
          <g className={anim("db-ant")} style={ad}><path d="M60 22 V10" stroke={c.shade} strokeWidth="4" strokeLinecap="round" /><circle cx="60" cy="8" r="6" fill={c.body} /></g>
          <rect x="16" y="22" width="88" height="80" rx="30" fill={`url(#${id}-b)`} />
          <rect x="27" y="38" width="66" height="42" rx="18" fill={`url(#${id}-v)`} />
          {eyes(48, 72, 55)}{mouth(60, 70)}
          <circle cx="24" cy="70" r="5" fill="#ff8a7a" opacity=".55" /><circle cx="96" cy="70" r="5" fill="#ff8a7a" opacity=".55" />
          <rect x="34" y="27" width="30" height="5" rx="2.5" fill="#fff" opacity=".35" />
        </>}
        {k === "scout" && <>
          <g className={anim("db-ant")} style={ad}><path d="M78 26 L88 10" stroke={c.shade} strokeWidth="4" strokeLinecap="round" /><circle cx="90" cy="8" r="7" fill="#0c0d11" stroke={c.body} strokeWidth="3" /><circle cx="91.5" cy="6.5" r="2" fill={c.glow} /></g>
          <circle cx="60" cy="62" r="44" fill={`url(#${id}-b)`} />
          <rect x="24" y="44" width="72" height="38" rx="19" fill={`url(#${id}-v)`} />
          {eyes(46, 74, 60, 5.6)}{mouth(60, 74)}
          <path d="M34 30 q14 -10 30 -8" stroke="#fff" strokeWidth="5" strokeLinecap="round" fill="none" opacity=".35" />
        </>}
        {k === "bolt" && <>
          <g className={anim("db-ant")} style={ad}><path d="M60 16 l-6 9 h7 l-4 9" stroke={c.shade} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" fill="none" /><circle className={anim("db-spark")} cx="60" cy="13" r="4" fill="#ffe27a" /></g>
          <rect x="26" y="30" width="68" height="76" rx="26" fill={`url(#${id}-b)`} />
          <rect x="34" y="42" width="52" height="32" rx="14" fill={`url(#${id}-v)`} />
          {eyes(50, 70, 56, 4.8)}{mouth(60, 67)}
          <rect x="44" y="84" width="32" height="10" rx="5" fill={c.shade} opacity=".7" /><circle cx="52" cy="89" r="2" fill={c.glow} /><circle cx="60" cy="89" r="2" fill={c.glow} /><circle cx="68" cy="89" r="2" fill={c.glow} />
          <rect x="38" y="35" width="22" height="4.5" rx="2.25" fill="#fff" opacity=".35" />
        </>}
      </g>
    </svg>
  );
}
