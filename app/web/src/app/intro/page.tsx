"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Welcome } from "@/components/Welcome";

function W() {
  const next = useSearchParams().get("next");
  const done = next && next.startsWith("/") && !next.startsWith("//") ? next : "/social";
  return <Welcome done={done} />;
}

/** First-run slides, shown once after registration. */
export default function IntroPage() {
  return <Suspense fallback={null}><W /></Suspense>;
}
