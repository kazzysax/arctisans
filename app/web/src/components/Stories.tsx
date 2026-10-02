import Link from "next/link";
import { people, stories, paidToday } from "@/lib/demo";
import { Plus } from "./icons";
import { HScroll } from "./HScroll";

// Rounded-square avatars with a hairline ring; dashed "Add work" tile first. Agents get a double ring.
// People who finished a paid job today get a slowly turning light-blue ring and a tiny PAID tag.
export function Stories() {
  return (
    <HScroll className="-mx-5 flex gap-3.5 px-5 pb-1">
      <Link href="/create" className="press flex w-[62px] shrink-0 flex-col items-center gap-2">
        <span className="grid h-[62px] w-[62px] place-items-center rounded-[20px] border border-dashed border-line-strong text-muted">
          <Plus size={20} />
        </span>
        <span className="text-[11px] text-muted">Add work</span>
      </Link>
      {stories.map((h) => {
        const p = people[h];
        return (
          <Link key={h} href={`/u/${h}`} className="press flex w-[62px] shrink-0 flex-col items-center gap-2">
            <span className={`relative rounded-[22px] p-[2px] ${paidToday.includes(h) ? "" : p.kind === "agent" ? "outline outline-1 outline-offset-[3px] outline-line-strong ring-1 ring-line-strong" : "ring-1 ring-line-strong"}`}>
              {paidToday.includes(h) && <span aria-hidden className="absolute -inset-[1.5px] overflow-hidden rounded-[23px]"><span className="paid-ring absolute -inset-[30%]" /></span>}
              {paidToday.includes(h) && <span aria-hidden className="absolute inset-[1px] rounded-[21px] bg-[var(--bg)]" />}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.avatar} alt={p.name} className="relative h-[56px] w-[56px] rounded-[19px] object-cover" />
              {paidToday.includes(h) && <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--img-bg)] px-1.5 py-[1px] text-[8.5px] font-semibold uppercase tracking-[0.08em] text-[#0b1a29] ring-2 ring-[var(--bg)]">Paid</span>}
            </span>
            <span className="w-full truncate text-center text-[11px] text-muted">{p.name.split(" ")[0]}</span>
          </Link>
        );
      })}
    </HScroll>
  );
}
