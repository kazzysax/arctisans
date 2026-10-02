"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mark } from "@/components/Logo";
import { circleReady, signInWithEmail, finishLogin } from "@/lib/walletClient";

// Sign-up: full-bleed dewy macro photo tinted light blue, a solid square block with spaced serif capitals (reference),
// and the email / Google sign-in under it.
// Auth flow:
//  1. User enters email → we POST to Circle to send OTP (via W3S SDK)
//  2. User enters OTP  → Circle returns userToken
//  3. We POST userToken to /api/auth/circle → server verifies, sets session cookie
//  4. If profile exists → /social; if not → /setup

export default function SignUp() {
  const r = useRouter();
  const [step, setStep] = useState<"start" | "code">("start");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const hasCircle = circleReady();

  async function handleEmailContinue() {
    setError(null);
    if (!hasCircle) { r.push("/setup"); return; } // no Circle App ID configured: demo path
    setLoading(true);
    setStep("code");
    try {
      const login = await signInWithEmail(email); // emails the code, opens Circle's window to enter it
      const { hasProfile } = await finishLogin(login); // creates the wallet on first visit, then our session
      r.push(hasProfile ? "/social" : "/setup");
    } catch (e) {
      setError((e as Error).message);
      setStep("start");
    } finally {
      setLoading(false);
    }
  }

  function handleGoogle() {
    setError(null);
    if (!hasCircle) { r.push("/setup"); return; }
    setError("Google sign-in is coming next. Please use your email for now.");
  }

  return (
    <main className="relative min-h-dvh overflow-hidden bg-black text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/demo/bg_blue.jpg" alt="" className="absolute inset-0 h-full w-full scale-110 object-cover" />
      <div className="absolute inset-0 bg-[radial-gradient(120%_70%_at_50%_35%,transparent_0%,rgba(4,14,26,0.18)_55%,rgba(0,0,0,0.7)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[64%] bg-gradient-to-t from-black from-[42%] via-black/85 to-transparent" />

      <div className="relative mx-auto flex min-h-dvh max-w-[440px] flex-col px-6 pb-[max(28px,env(safe-area-inset-bottom))] pt-[max(22px,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between text-white/80">
          <Mark size={26} />
          <span className="text-[11px] uppercase tracking-[0.3em]">On Arc</span>
        </div>

        {/* the square block */}
        <div className="rise mx-auto mt-[9vh] grid aspect-square w-[58%] max-w-[230px] place-items-center bg-[#0b1a29]/90 px-4 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.8)]">
          <div>
            <div className="font-serif text-[30px] font-medium uppercase leading-[1.05] tracking-[0.26em] text-[#e6f1fb]">Arcti<br />sans</div>
            <div className="mx-auto my-3 h-px w-10 bg-white/25" />
            <div className="text-[9.5px] uppercase tracking-[0.32em] text-white/55">Work · Hire · Paid</div>
          </div>
        </div>

        <div className="flex-1" />

        {step === "start" ? (
          <div className="rise" style={{ animationDelay: "120ms" }}>
            <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.035em]">Show your work.<br /><span className="text-white/55">Get hired. Get paid.</span></h1>
            <p className="mt-3 max-w-[330px] text-[14px] leading-relaxed text-white/60">For tailors, writers, designers, builders and AI agents. Every job and payment is provable on Arc.</p>

            {error && <p className="mt-3 rounded-xl bg-red-900/60 px-4 py-2.5 text-[13px] text-red-200">{error}</p>}

            <div className="mt-7 flex flex-col gap-2.5">
              <button id="signin-google" onClick={handleGoogle} disabled={loading} className="press flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-white text-[15px] font-medium text-black disabled:opacity-50">
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                Continue with Google
              </button>
              <div className="my-1.5 flex items-center gap-3 text-[11px] uppercase tracking-[0.2em] text-white/35"><span className="h-px flex-1 bg-white/12" />or<span className="h-px flex-1 bg-white/12" /></div>
              <label className="sr-only" htmlFor="email">Email</label>
              <input id="email" type="email" inputMode="email" autoComplete="email" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)}
                className="h-[52px] rounded-full border border-white/15 bg-white/[0.07] px-5 text-[15px] text-white outline-none backdrop-blur-xl placeholder:text-white/35 focus:border-white/35" />
              <button id="signin-email" disabled={!valid || loading} onClick={handleEmailContinue} className="press h-[52px] rounded-full border border-white/25 text-[15px] font-medium text-white transition-opacity disabled:opacity-35">
                {loading ? "Sending…" : "Continue with email"}
              </button>
            </div>
            <p className="mt-5 text-center text-[11.5px] leading-relaxed text-white/40">No seed phrase. Your wallet is created for you.<br />By continuing you agree to the Terms.</p>
          </div>
        ) : (
          <div className="rise">
            <button onClick={() => { setStep("start"); setError(null); }} className="mb-5 text-[13px] text-white/55">← Change email</button>
            <h1 className="text-[28px] font-semibold tracking-[-0.035em]">Check your inbox</h1>
            <p className="mt-2 text-[14px] leading-relaxed text-white/60">We sent a 6-digit code to <span className="text-white">{email}</span>. Enter it in the secure window that just opened.</p>
            {error && <p className="mt-3 rounded-xl bg-red-900/60 px-4 py-2.5 text-[13px] text-red-200">{error}</p>}
            <div className="mt-8 flex items-center gap-3 text-[13px] text-white/55"><span className="h-4 w-4 rounded-full border-2 border-white/50 border-t-transparent" style={{ animation: "spin .8s linear infinite" }} />Waiting for you…</div>
            <p className="mt-6 text-[12px] leading-relaxed text-white/40">First time here? You&apos;ll also approve creating your wallet. There&apos;s no seed phrase to keep, and sending money costs you no network fees.</p>
          </div>
        )}
      </div>
    </main>
  );
}
