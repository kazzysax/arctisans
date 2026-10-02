# R4 — Arctisans app stack (implementation research)

Date: 2026-10-02. Versions from `npm view <pkg> version` on that date. Pricing pages fetched via r.jina.ai the same day.

## 0. Machine check (done, nothing created)
- node v24.15.0, npm 11.12.1 (Circle Node SDK needs node >=22 — OK).
- vercel CLI installed, **logged in** as officialsaxnk@gmail.com.
- railway CLI installed (whoami hung >120 s — treat as **not logged in / unknown**).
- gh CLI logged in as **kazzysax** (https, keyring).
- Arc mainnet RPC `https://rpc.mainnet.arc.io` live: `eth_chainId` → `0x13b2` (= 5042).
- viem ships `arc` (5042) and `arcTestnet` chain definitions (src/chains/definitions/arc.ts): native USDC 18 decimals, multicall3 `0xcA11…CA11`, explorer `explorer.arc.io` (Blockscout-style `/api/v2`).

## 1. Frontend
**Pick: Next.js 16.3.8 (App Router) + React 19.3 + TypeScript + Tailwind CSS 4.3.3 + shadcn/ui (CLI 4.21.1) + motion 13.5.0 + next-themes 0.4.6 + viem 2.57.2 + zod 4.6.5.**
- Theming: `next-themes` `ThemeProvider attribute="class" defaultTheme="system"`; shadcn CSS variables give dark+light for free. Mobile-first Tailwind breakpoints.
- Chain reads: viem `createPublicClient({ chain: arc, transport: fallback([...4 RPCs]) })` on server and client. Arc quirks (docs.arc.io): USDC native = 18 decimals but the ERC-20 USDC interface = 6; 20 gwei maxFeePerGas floor; sub-second finality (1 confirmation is enough).
- Circle Web SDK `@circle-fin/w3s-pw-web-sdk` 1.1.11: deps `firebase ^10`, `uuid`, `jsonwebtoken`, no React peer dep (framework-agnostic, touches `window`). Official example is CRA + React 18 with browserify polyfills (buffer, crypto, stream). **Risk:** must load it client-only (`"use client"` + `dynamic(() => import(...), { ssr:false })` / import inside `useEffect`); may need `buffer` polyfill in Next. Spike this first (30 min).
- Alternatives: Vite+React SPA (simpler SDK integration, but loses SSR/OG/route handlers); Remix/React Router 7 (fine, less familiar to agent tooling). Next wins for OG images, SEO share pages and one-deploy backend.

## 2. Backend + auth/session
**Pick: Next.js route handlers (`app/api/**`) + server actions in the same app; no separate service for v1.**
- Server SDK `@circle-fin/user-controlled-wallets` 10.8.1 (node >=22) for: create user, `POST /users/email/token` (otpToken, deviceToken, deviceEncryptionKey), `POST /users/social/token`, create wallet / challenges.
- Flow: client SDK `verifyOTP` / Google `performLogin` → returns `userId, userToken, encryptionKey, refreshToken` (userToken lives 14 days, refreshable). Client POSTs `userToken` to `/api/auth/session`; server calls Circle `getUser`/`listWallets` with that token to **verify it** and resolve wallet address, upserts `users` row, then sets **our own httpOnly session cookie** (JWT signed with `jose` 6.2.12, 14 d; or `iron-session` 9.0.1). Keep `userToken`+`encryptionKey` client-side only (needed for signing challenges); never store in DB.
- Agent API: `Authorization: Bearer ak_…` keys; store SHA-256 hash + prefix in DB; same route handlers.
- Separate service (Railway Express/Hono) only if long-running indexer is needed (see §6).

## 3. Database + ORM
**Pick: Neon Postgres (free) + Drizzle ORM 0.45.3 / drizzle-kit 0.31.11, driver `@neondatabase/serverless` 1.2.0 (HTTP, ideal for Vercel functions).**
- Neon Free: no time limit, no card, ~1 GB storage/project (per pricing page; older docs say 0.5 GB), scale-to-zero (cold start ~0.5 s), branching for preview DBs. Vercel Marketplace one-click integration.
- Alt: Supabase Free — 500 MB DB, 1 GB file storage, 5 GB egress, 50k MAU, **paused after 1 week inactivity**, max 2 projects. Good if we want storage+DB in one account, but pause risk + we don't need Supabase Auth (Circle is auth). Prisma: heavier, slower cold starts; Drizzle is SQL-like and agent-friendly.
- Search & filters: Postgres `ILIKE`/`pg_trgm` + indexed columns (skill, is_agent, price, rating). No separate search service.

## 4. Images
**Pick: client compression with `browser-image-compression` 2.0.2 → upload to our `/api/upload` → server validates → pin to IPFS via Pinata (`pinata` SDK 2.5.6); store CID in DB; CID (content hash) can go onchain if needed.**
- Client: `imageCompression(file,{maxSizeMB:0.5,maxWidthOrHeight:1600,useWebWorker:true,fileType:'image/webp'})`, max 3 per post, accept `image/jpeg,png,webp` only.
- Server: check magic bytes with `file-type` 22.1.1 (reject non-images/video/SVG), size cap ~1 MB, optionally re-encode + strip EXIF with `sharp` 0.35.5 (works on Vercel). Prefer **signed upload via server** (keeps Pinata JWT secret); Pinata also supports presigned URLs for direct client upload.
- Pinata Free: 1 GB storage, 1 dedicated gateway, API 60 req/min. 1 GB ≈ 3–5k compressed images — enough for launch. Serve via the dedicated gateway + `next/image` remotePatterns.
- Alt: Supabase Storage (1 GB, 5 GB egress, simple, but pause risk); Vercel Blob (free tier small, not content-addressed). Hash-onchain works with any of them; IPFS gives it natively.

## 5. Email OTP (SMTP for Circle)
**Pick: Resend (SDK `resend` 6.32.0 if we ever send our own mail).** Circle requires our own SMTP (configured in Circle Console; Circle sends the OTP through it).
- Resend Free: **3,000 emails/month, 100/day hard cap**, 1 domain. SMTP: host `smtp.resend.com`, port 465 (SSL) or 587 (STARTTLS), user `resend`, password = API key → standard SMTP creds, compatible with Circle's SMTP form.
- Needs a verified sending domain (DNS: SPF/DKIM TXT records) — owner must own a domain.
- **Risk:** 100/day caps sign-ups/logins on launch day; Google login does not use email. Alternative: Brevo free (300/day, SMTP) as fallback/upgrade; Resend Pro $20/mo removes daily cap.

## 6. Indexing onchain events → DB
Indexers supporting **Arc mainnet 5042** (verified): Envio HyperIndex/HyperSync (`5042.hypersync.xyz`), Goldsky (subgraphs+mirror, mainnet+testnet), The Graph (Studio, "arc"), Alchemy (Data APIs + webhooks; listed in Arc docs). Ponder 0.17.12 works on any EVM RPC (self-hosted, needs a long-running process + its own Postgres schema).
**Pick: own lightweight ingester in the Next app, no third-party indexer for v1.**
- (a) **Receipt-driven ingest**: after each tx (tip, invoice, escrow release, review) client calls `/api/chain/sync {txHash}`; server `getTransactionReceipt`, `parseEventLogs` with our ABIs (only our contract addresses), upserts rows idempotently (unique `tx_hash+log_index`). Instant feeds/notifications.
- (b) **Catch-up poller** `/api/cron/index` (secret-protected): `getLogs` from `sync_state.last_block` in ≤2k-block chunks for our contracts, same upsert. Triggered by GitHub Actions `schedule: */5 * * * *` (curl) since Vercel Hobby cron = once/day only. Reputation card = SQL aggregates over indexed events.
- Upgrade path: Envio HyperIndex or Goldsky subgraph when volume grows; Alchemy webhooks for push.
- Risks: GitHub cron can lag 5–15 min (receipt path covers UX); public RPC rate limits → use `fallback` transport.

## 7. Hosting
**Pick: Vercel (Hobby to launch) for the Next app; GitHub repo `kazzysax/arctisans` with auto-deploys.**
- Vercel Hobby: 1M function invocations, 4 active-CPU-hrs, 100 GB transfer, 1M CDN requests, 100 deploys/day; cron limited to **once per day (±59 min)**; **non-commercial use only** → move to Pro ($20/mo) once fees/revenue start. CLI already logged in. Best-in-class for Next 16, next/og, previews.
- Alt: Railway (owner already uses for Cerebra) — 30-day trial $5 credit then Hobby $5/mo; runs Next as a long-lived Node server, proper cron, could host Ponder. No commercial restriction. Choose Railway instead if owner refuses Vercel's non-commercial clause; same code works (`next start`).
- Region: Vercel `fra1`/`iad1` both fine for Nigeria; pick `fra1` near Neon `aws-eu-central-1`.

## 8. OG share images
**Pick: `next/og` `ImageResponse` (built into Next 16, Satori-based)** via `opengraph-image.tsx` in `app/u/[handle]/` (CV) and `app/invoice/[id]/` (invoice), plus `generateMetadata` for title/description/twitter card. Edge/Node runtime; flexbox-only CSS, bundle fonts (.ttf) locally, 1200×630, cache with `revalidate`. Alt: `@vercel/og` standalone (same engine) or Puppeteer screenshot (too heavy).

## 9. Testing
**Pick: Vitest 5.0.3 (unit: zod schemas, event parsing, reputation math, API key hashing; `@testing-library/react` for components) + Playwright 1.63.0 (`@playwright/test`) e2e on phone (Pixel 7/iPhone viewport) + desktop, both color schemes (`colorScheme:'dark'|'light'`).** Mock Circle SDK in e2e via a `NEXT_PUBLIC_E2E_AUTH=1` test login route (dev only). Contracts tested separately with Foundry (Arc Foundry fork).

## Proposed repo structure (`C:/Users/HP/Arctisan/app` → GitHub kazzysax/arctisans)
```
arctisans/
  app/
    (marketing)/page.tsx            landing
    (auth)/login/page.tsx           email OTP + Google (Circle SDK, client-only)
    feed/work/  feed/requests/      feeds
    u/[handle]/page.tsx + opengraph-image.tsx      CV profile
    invoice/[id]/page.tsx + opengraph-image.tsx    invoice/escrow
    agreements/new/  search/  notifications/  settings/  admin/
    api/
      auth/{email-token,social-token,session,logout}/route.ts
      upload/route.ts              validate + pin to Pinata
      posts/ follows/ likes/ reviews/ search/ notifications/
      chain/sync/route.ts          receipt-driven ingest
      cron/index/route.ts          getLogs catch-up (CRON_SECRET)
      v1/**                        agent API (API-key auth)
  components/ (ui/ = shadcn)  theme-provider.tsx  circle/CircleProvider.tsx
  lib/
    chain/{client.ts,abis/,addresses.ts,ingest.ts}  viem + arc
    circle/server.ts               @circle-fin/user-controlled-wallets
    db/{schema.ts,index.ts}        drizzle + neon
    auth/{session.ts,apikeys.ts}   jose cookie, key hashing
    storage/pinata.ts  images/validate.ts  reputation.ts
  contracts/                        Foundry (Invoice/Escrow/Tips/Reviews)
  drizzle/ (migrations)  tests/unit/  tests/e2e/
  .github/workflows/{ci.yml,index-cron.yml}
  drizzle.config.ts  next.config.ts  vitest.config.ts  playwright.config.ts  .env.example
```

## Accounts / keys the OWNER must create
1. **Circle Developer Console** (console.circle.com): user-controlled wallets app → `CIRCLE_API_KEY` (server), `NEXT_PUBLIC_CIRCLE_APP_ID`; enable Email OTP (enter Resend SMTP) and Google social login.
2. **Google Cloud OAuth client** (Web) → `NEXT_PUBLIC_GOOGLE_CLIENT_ID`, authorized redirect = our domain (configured in Circle console).
3. **Domain** (e.g. arctisans.xyz) — needed for Resend sender + Google OAuth + nice share links.
4. **Resend** account + verified domain (DNS records) → SMTP password/API key `RESEND_API_KEY` (put into Circle console).
5. **Neon** project (eu-central) → `DATABASE_URL` (pooled) — or via Vercel Marketplace integration.
6. **Pinata** account → `PINATA_JWT`, `NEXT_PUBLIC_PINATA_GATEWAY` (dedicated gateway domain).
7. **Vercel** (already logged in) — link project; set env vars; later Pro if commercial.
8. **GitHub** (kazzysax exists) — new repo; Actions secret `CRON_SECRET` + `APP_URL` for index cron.
9. Deployer wallet funded with **USDC on Arc mainnet** (gas) → `DEPLOYER_PRIVATE_KEY` used only locally for Foundry deploys; contract addresses → `NEXT_PUBLIC_*_ADDRESS`.
10. Generated by us (no account): `SESSION_SECRET` (32+ bytes), `CRON_SECRET`, `ADMIN_EMAILS`/admin wallet list.
Optional: Alchemy/QuickNode Arc RPC key (`ARC_RPC_URL`) if public RPCs rate-limit; Railway (only if hosting moves there).

## Top risks
1. Circle web SDK in Next 16/React 19 (client-only load, polyfills) — spike first.
2. Resend free 100 emails/day cap on OTP.
3. Vercel Hobby non-commercial clause + daily-only cron (mitigated by GitHub Actions + receipt ingest).
4. Pinata/Neon 1 GB caps; Neon cold starts.
5. Arc USDC decimals (18 native vs 6 ERC-20) in tips/escrow math.

## Sources
- npm registry (`npm view`), 2026-10-02 — all versions above.
- viem chains: github.com/wevm/viem/blob/main/src/chains/definitions/arc.ts
- Arc docs: docs.arc.io/llms.txt, /arc/tools/data-indexers.md, /arc/references/evm-differences.md
- Envio networks: docs.envio.dev/docs/HyperIndex/supported-networks · Goldsky: docs.goldsky.com/chains/supported-networks · The Graph: thegraph.com/docs/en/supported-networks/
- Circle auth: local docs/research/authentication-methods.md (SMTP own provider; userToken 14 d); github.com/circlefin/w3s-pw-web-sdk (react-example package.json)
- Vercel: vercel.com/docs/plans/hobby, /docs/cron-jobs/usage-and-pricing, /docs/limits
- Railway: railway.com/pricing · Supabase: supabase.com/pricing · Neon: neon.com/pricing
- Pinata: pinata.cloud/pricing, docs.pinata.cloud/account-management/limits
- Resend: resend.com/pricing; SMTP: resend.com/docs/send-with-smtp
