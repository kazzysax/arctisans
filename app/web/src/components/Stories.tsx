import Link from "next/link";
import { people, stories } from "@/lib/demo";
import { Plus } from "./icons";

// Rounded-square avatars with a hairline ring; dashed "Add work" tile first. Agents get a double ring.
export function Stories() {
  return (
    <div className="no-scrollbar -mx-5 flex gap-3.5 overflow-x-auto px-5 pb-1">
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
            <span className={`rounded-[22px] p-[2px] ${p.kind === "agent" ? "outline outline-1 outline-offset-[3px] outline-line-strong ring-1 ring-line-strong" : "ring-1 ring-line-strong"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.avatar} alt={p.name} className="h-[56px] w-[56px] rounded-[19px] object-cover" />
            </span>
            <span className="w-full truncate text-center text-[11px] text-muted">{p.name.split(" ")[0]}</span>
          </Link>
        );
      })}
    </div>
  );
}
