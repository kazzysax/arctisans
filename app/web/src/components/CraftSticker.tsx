// A little sticker on someone's photo showing what they do: their craft's drawing on its soft colour, die-cut white edge.
import { CraftArt } from "./CraftArt";
import { craftById } from "@/lib/crafts";

export function CraftSticker({ craft, size = 40, className = "" }: { craft?: string | null; size?: number; className?: string }) {
  const c = craftById(craft);
  if (!c) return null;
  return (
    <span title={c.one} className={`craft-sticker grid place-items-center overflow-hidden rounded-full ring-[3px] ring-white shadow-[0_6px_14px_-4px_rgba(15,34,54,0.4)] ${className}`}
      style={{ width: size, height: size, background: c.tint, padding: size * 0.1 }}>
      <span className="block h-full w-full scale-[1.45]"><CraftArt id={c.id} /></span>
    </span>
  );
}
