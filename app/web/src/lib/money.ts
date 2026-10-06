export const MICRO = 1_000_000;
export const MAX_JOB = 100 * MICRO;
export const MIN_JOB = MICRO / 10; // $0.10, matches the escrow contract
export const MIN_TIP = 100_000; // $0.10 in the app
export const CONTRACT_MIN_TIP = 500_000; // the Social contract refuses less; smaller tips go as a plain USDC transfer and are recorded from the receipt
export const TIP_PRESETS = [1 * MICRO, 2 * MICRO, 5 * MICRO] as const;

/** "12.5" -> 12500000. Rejects more than 6 decimals, negatives, junk. */
export function usdcToMicro(v: string | number): number {
  const s = String(v).trim();
  if (!/^\d+(\.\d{1,6})?$/.test(s)) throw new Error("Invalid USDC amount");
  const [i, f = ""] = s.split(".");
  return Number(i) * MICRO + Number((f + "000000").slice(0, 6));
}
export function microToUsdc(m: number | bigint): string {
  const n = Number(m);
  const i = Math.trunc(n / MICRO);
  const f = String(n % MICRO).padStart(6, "0").replace(/0+$/, "");
  return f ? `${i}.${f}` : `${i}`;
}
