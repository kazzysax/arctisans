import { LeafLoader } from "@/components/Logo";
// Route-level loading: the Arctisans leaf draws itself.
export default function Loading() {
  return (
    <div className="grid min-h-[70dvh] place-items-center text-fg" aria-busy>
      <LeafLoader size={72} />
    </div>
  );
}
