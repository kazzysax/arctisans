"use client";
import { useEffect, useRef } from "react";

/** Odometer: every digit rolls to its new value (on mount from 0, then on every change). */
export function Roll({ value, prefix = "", decimals = 0, className = "" }: { value: number; prefix?: string; decimals?: number; className?: string }) {
  const text = prefix + value.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  const chars = [...text];
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      chars.forEach((c, i) => {
        const el = refs.current[i];
        if (el && /\d/.test(c)) el.style.transform = `translateY(-${Number(c) * 10}%)`;
      });
    });
    return () => cancelAnimationFrame(id);
  });
  return (
    <span className={`num inline-flex items-start leading-[1.15] ${className}`} aria-label={text}>
      {chars.map((c, i) => {
        const key = chars.length - i; // keyed from the right so columns stay put as the number grows
        if (!/\d/.test(c)) return <span key={key} aria-hidden>{c}</span>;
        return (
          <span key={key} aria-hidden className="relative inline-block h-[1.15em] overflow-hidden leading-[1.15em]">
            <span ref={(el) => { refs.current[i] = el; }} className="roll-col" style={{ transform: "translateY(0)" }}>
              {Array.from({ length: 10 }, (_, d) => <span key={d} className="block h-[1.15em] leading-[1.15em]">{d}</span>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}
