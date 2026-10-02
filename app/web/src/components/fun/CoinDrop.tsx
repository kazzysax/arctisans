"use client";
/** After a tip: a light-blue coin flips down into the creator's avatar, which pulses once. */
export function CoinDrop({ k, avatar, amount }: { k: number; avatar: string; amount: number }) {
  if (!k) return null;
  return (
    <div key={k} className="pointer-events-none flex flex-col items-center" style={{ perspective: 600 }}>
      <div className="relative h-[150px] w-full">
        <span className="absolute bottom-0 left-1/2 -ml-[22px] grid h-11 w-11 place-items-center rounded-full bg-[var(--img-bg)] text-[15px] font-semibold text-[#0b1a29] shadow-[inset_0_-3px_0_rgba(20,60,100,.25),inset_0_2px_0_rgba(255,255,255,.7),0_8px_22px_-6px_rgba(90,150,210,.7)]"
          style={{ animation: "coinDrop 1000ms var(--ease-out) both" }}>$</span>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={avatar} alt="" className="h-16 w-16 rounded-[20px] object-cover" style={{ animation: "ringOut 700ms ease-out 900ms both" }} />
      <div className="num mt-4 text-[34px] font-semibold" style={{ animation: "rise 500ms var(--ease-out) 950ms both" }}>${amount.toFixed(2)}</div>
    </div>
  );
}
