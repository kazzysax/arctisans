"use client";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const noop = () => () => {};
export function ThemeToggle({ className = "hairline text-muted" }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(noop, () => true, () => false);
  const dark = !mounted || resolvedTheme === "dark";
  return (
    <button aria-label="Toggle light and dark" onClick={() => setTheme(dark ? "light" : "dark")} className={`press grid h-10 w-10 place-items-center rounded-full ${className}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="12" cy="12" r="7.5" /><path d="M12 4.5a7.5 7.5 0 0 1 0 15z" fill="currentColor" />
      </svg>
    </button>
  );
}
