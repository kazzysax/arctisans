import type { JobState } from "@/lib/demo";
// Monochrome status: filled dot = needs you, ring = waiting, check = done.
export function StateTag({ s }: { s: JobState }) {
  const mark = s === "Completed" ? <span aria-hidden>✓</span> : null;
  const hot = s === "Delivered" || s === "Proposed" || s === "Settlement";
  return (
    <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-medium ${hot ? "bg-pill text-pill-fg" : "hairline text-muted"}`}>
      {mark ?? <span className={`h-1.5 w-1.5 rounded-full ${hot ? "bg-[var(--pill-fg)]" : "border border-current"}`} />}{s}
    </span>
  );
}
