"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
let deferred: BIPEvent | null = null; // kept at module level so every button can use the same browser prompt

/** "Add to home screen". Android/Chrome: one tap opens the system install dialog. iPhone: shows the Share, Add to Home Screen steps. Hidden once installed. */
export function AddToHome({ variant = "card" }: { variant?: "card" | "button" }) {
  const [ready, setReady] = useState(false), [ios, setIos] = useState(false), [installed, setInstalled] = useState(false), [steps, setSteps] = useState(false), [gone, setGone] = useState(false);
  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInstalled(standalone); setIos(/iphone|ipad|ipod/i.test(navigator.userAgent)); setGone(localStorage.getItem("a2hs_hide") === "1");
    if (deferred) setReady(true);
    const on = (e: Event) => { e.preventDefault(); deferred = e as BIPEvent; setReady(true); };
    const done = () => { deferred = null; setInstalled(true); };
    window.addEventListener("beforeinstallprompt", on); window.addEventListener("appinstalled", done);
    return () => { window.removeEventListener("beforeinstallprompt", on); window.removeEventListener("appinstalled", done); };
  }, []);
  if (installed || (variant === "card" && gone)) return null;
  async function go() {
    if (deferred) { await deferred.prompt(); const c = await deferred.userChoice; if (c.outcome === "accepted") setInstalled(true); deferred = null; setReady(false); }
    else setSteps(true); // iPhone, or a browser that has not offered the prompt: show the manual steps
  }
  const btn = <button onClick={go} className={variant === "button" ? "btn btn-solid mt-3 w-full" : "btn btn-solid h-9 shrink-0 px-4 text-[13px]"}>Add to home screen</button>;
  return (
    <>
      {variant === "button" ? btn : (
        <div className="mx-5 mt-4 flex items-center gap-3 rounded-[22px] bg-[var(--img-bg)] p-4 text-[#0b1a29]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icon-192.png" alt="" className="h-11 w-11 rounded-[12px]" />
          <div className="min-w-0 flex-1 leading-tight"><div className="text-[14px] font-semibold">Keep Arctisans on your phone</div><div className="mt-0.5 text-[12px] opacity-70">Opens full screen, like an app.</div></div>
          {btn}
          <button aria-label="Hide" onClick={() => { localStorage.setItem("a2hs_hide", "1"); setGone(true); }} className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[16px] opacity-50">×</button>
        </div>
      )}
      {steps && (
        <div className="fixed inset-0 z-[80] grid place-items-end bg-black/50 sm:place-items-center" onClick={() => setSteps(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[420px] rounded-t-[28px] bg-[var(--bg)] p-6 pb-[max(24px,env(safe-area-inset-bottom))] sm:rounded-[28px]">
            <div className="text-[18px] font-semibold tracking-[-0.02em]">Add Arctisans to your home screen</div>
            {ios ? (
              <ol className="mt-4 flex flex-col gap-3 text-[14px] leading-snug">
                <li><b>1.</b> Open this page in <b>Safari</b> (not inside another app).</li>
                <li><b>2.</b> Tap the <b>Share</b> button (the square with an arrow, at the bottom).</li>
                <li><b>3.</b> Scroll down and tap <b>Add to Home Screen</b>, then <b>Add</b>.</li>
              </ol>
            ) : (
              <ol className="mt-4 flex flex-col gap-3 text-[14px] leading-snug">
                <li><b>1.</b> Open the browser menu (the three dots, top right).</li>
                <li><b>2.</b> Tap <b>Install app</b> or <b>Add to Home screen</b>.</li>
                <li><b>3.</b> Confirm. It appears with the Arctisans icon.</li>
              </ol>
            )}
            <button onClick={() => setSteps(false)} className="btn btn-solid mt-5 w-full">Got it</button>
          </div>
        </div>
      )}
    </>
  );
}
