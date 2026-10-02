"use client";
import { Empty } from "@/components/fun/Empty";
export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-[480px] pt-[18vh]">
      <Empty art="bell" title="Something went wrong" body="Your money is safe in escrow. Try again in a moment." />
      <div className="flex justify-center"><button onClick={reset} className="btn btn-solid btn-sm">Try again</button></div>
    </div>
  );
}
