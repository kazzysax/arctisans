"use client";
import { useRef } from "react";

// Horizontal row that scrolls by swipe (touch), mouse drag and mouse wheel (laptop).
export function HScroll({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  return (
    <div
      ref={ref}
      className={`no-scrollbar overflow-x-auto overscroll-x-contain ${className}`}
      onWheel={(e) => {
        const el = ref.current;
        if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
          const atStart = el.scrollLeft <= 0 && e.deltaY < 0, atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1 && e.deltaY > 0;
          if (!atStart && !atEnd) el.scrollLeft += e.deltaY;
        }
      }}
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || !ref.current) return;
        drag.current = { x: e.clientX, left: ref.current.scrollLeft, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current, el = ref.current;
        if (!d || !el) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 4) { d.moved = true; el.style.scrollSnapType = "none"; el.scrollLeft = d.left - dx; }
      }}
      onPointerUp={() => { if (ref.current) ref.current.style.scrollSnapType = ""; setTimeout(() => (drag.current = null), 0); }}
      onPointerLeave={() => { if (ref.current) ref.current.style.scrollSnapType = ""; drag.current = null; }}
      onClickCapture={(e) => { if (drag.current?.moved) { e.preventDefault(); e.stopPropagation(); } }}
    >
      {children}
    </div>
  );
}
