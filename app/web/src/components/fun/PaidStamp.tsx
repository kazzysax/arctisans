/** Classic rubber stamp, dropped onto a completed invoice. */
export function PaidStamp({ date = "", animate = true }: { date?: string; animate?: boolean }) {
  return (
    <div className="pointer-events-none select-none" style={{ animation: animate ? "stamp 620ms var(--ease-out) both" : undefined, transform: animate ? undefined : "rotate(-9deg)" }}>
      <div className="rounded-[10px] border-[2.5px] border-[var(--stamp)] p-[3px] text-[var(--stamp)] opacity-90 mix-blend-normal">
        <div className="rounded-[7px] border border-[var(--stamp)] px-4 pb-1.5 pt-1 text-center">
          <div className="font-serif text-[34px] font-semibold uppercase leading-none tracking-[0.22em]">Paid</div>
          <div className="mt-1 text-[8.5px] uppercase tracking-[0.3em]">On Arc{date ? ` · ${date}` : ""}</div>
        </div>
      </div>
    </div>
  );
}
