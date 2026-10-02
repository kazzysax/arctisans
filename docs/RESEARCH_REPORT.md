# Arctisans: Implementation Research Report (Phase 2)

Oct 2, 2026. Details and sources are in `research/R1–R4`. Nothing has been created, deployed or paid for.

## Recommended route

| Layer | Choice | Why |
|---|---|---|
| Chain | Arc mainnet 5042, RPC `rpc.mainnet.arc.io`, USDC ERC-20 `0x3600…0000` (6 dec) | Verified live; required by the grant |
| Sign-in and wallets | Circle user-controlled wallets: **email OTP + Google**, SCA accounts | Arc mainnet supported; no seed phrase |
| Gas | Circle Gas Station mainnet policy (credit card billed) | Users never need gas |
| Payments in 1 tap | SCA `executeBatch` → approve(exact amount) + fund/tip in one transaction | One confirmation for the user |
| Agents | **ERC-8004 registries already live on Arc mainnet** (identity + reputation) + dev-controlled wallets; API keys + signed money calls; caps in backend + exact approvals | Standard, no registry to deploy; stats readable by other platforms |
| Contracts | 2 immutable contracts: `ArctisanEscrow` (only one holding money) + `ArctisanSocial` (profiles, posts, tips, reviews). OpenZeppelin v5.7. No admin can touch funds; pause can't trap funds; timers enforced by a permissionless `poke`, plus a keeper for convenience | Sketch already compiles; 5 tests + 1 invariant pass |
| App | Next.js 16 + React 19 + TypeScript + Tailwind 4 + shadcn/ui + motion + next-themes (dark/light) + viem | One codebase for frontend and API; share images built in |
| Database | Neon Postgres (free) + Drizzle | Free, no pausing |
| Pictures | Compressed in the browser (WebP ≤0.5 MB, max 3) → server checks they're real images → IPFS via Pinata (1 GB free) | Pictures only, provable by hash |
| Email codes | Resend SMTP (3,000/month, **100/day** free) | Works with Circle's SMTP setting |
| Indexing | Our own: read each transaction receipt right away + catch-up poller every 5 min | No third-party indexer needed for v1 |
| Hosting | Vercel (CLI already logged in) + GitHub `kazzysax/arctisans`; cron via GitHub Actions | Best fit for Next.js; Railway is the fallback |
| Tests | Foundry (unit, fuzz, invariant, Arc fork) + Vitest + Playwright (phone and desktop, both themes) | Playbook's terminal + Chrome proof |

## Risks
1. **Circle mainnet access (biggest).** It's unconfirmed whether a normal Console account can use mainnet user wallets immediately. The owner checks this first.
2. **Circle Web SDK inside Next.js 16.** It must be loaded on the client only and may need polyfills. Do a 30-minute spike first.
3. **Smart contracts with real money.** The design and sketch have no audit. Mitigations:
   - $100 cap
   - full test suite + Slither
   - testnet soak before mainnet
   - deploy only with owner approval
4. **Resend: 100 emails/day.** This caps email logins on launch day. Google login doesn't count toward it.
5. **ERC-8004 is a Draft.** The registries are upgradeable by one key we don't control. Wrap them behind an adapter; our escrow events stay the source of truth.
6. **Vercel Hobby is non-commercial.** Fine while the app is feeless; move to Pro or Railway if fees start.

## Owner setup needed before or at build start
1. **Circle Developer Console** (console.circle.com):
   - Switch to Mainnet and create an API key. **Confirm mainnet works.**
   - Set up user-controlled wallets: App ID, email OTP (Resend SMTP), Google.
   - Create a Gas Station mainnet policy for Arc, with a credit card on file.
   - Register the entity secret (for agent wallets).
2. **Domain** (e.g. arctisans.xyz). Needed for the email sender, Google login and share links.
3. **Resend** account, then verify the domain (DNS records).
4. **Google Cloud OAuth client** (web) → client ID into the Circle Console.
5. **Neon** and **Pinata** free accounts.
6. A deployer wallet with **about $5 USDC on Arc mainnet**.
7. GitHub (`kazzysax`) and Vercel: already logged in.

## Small decisions left
- Minimum job size: $1? (recommended)
- Can cancelled, never-paid jobs be reviewed? (recommended: no)
- Missed deadline: reputation only, with no money effect? (recommended: yes; keeps the 10 rules)
- Hosting: Vercel? (recommended) or Railway (which you use for Cerebra)

## Build order (tomorrow, playbook Speed Standard)
1. **Spike, 30 min:** Circle login (email + Google) working in Next.js on testnet.
2. **Contracts, about 2 h:** escrow + social from the sketch, the full test suite, deploy to **Arc testnet**.
3. **Core engine, about 2.5 h:** sign up → CV → post work → hire → agree → fund → start → deliver → approve → paid → review → reputation card, end to end on testnet in Chrome.
4. **Expand:** feeds, follow and likes, search, tips, settlement and deadlock UI, notifications, share images, dark/light, agent API and ERC-8004.
5. **Harden:** all checks, live Chrome on phone and desktop, security review.
6. **Mainnet deploy (after your yes)**, seed 5–10 real profiles, submit.
