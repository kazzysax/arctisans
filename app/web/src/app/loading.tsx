// Route-level loading: quiet skeletons in the layout's shape, never a spinner.
export default function Loading() {
  return (
    <div className="mx-auto max-w-[560px] px-5 pt-8" aria-busy>
      <div className="skeleton h-7 w-40 rounded-full" />
      <div className="mt-6 flex gap-3">{[0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-[60px] w-[60px] shrink-0 rounded-[20px]" />)}</div>
      <div className="mt-8 flex gap-3"><div className="skeleton h-[420px] w-[280px] shrink-0 rounded-[30px]" /><div className="skeleton h-[420px] w-[80px] rounded-[30px]" /></div>
    </div>
  );
}
