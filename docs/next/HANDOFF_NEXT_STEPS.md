# Arctisans — Handoff: what's left, and how to go to mainnet

Written Oct 2 for whoever (human or agent) continues this project from another
interface. Read this before touching anything. If you're an AI agent picking
this up cold, also read `docs/PRODUCT_BUILDING_PLAYBOOK.md` (the process this
project follows), `docs/SCOPE_v1.md` (product rules) and `docs/DECISION_RECORD.md`
(why things are the way they are).

**No audits in this pass, on purpose.** The user wants a straight mainnet
deploy now and will come back later specifically for an audit. Don't add a
security-review step unless asked — just don't skip the safety checks in
Phase 2 below (those are cheap and you can do them yourself).

---

## 1. Where things stand

- **Contracts** (`app/contracts/`, Foundry): `ArctisanEscrow.sol` +
  `ArctisanSocial.sol`. 24 tests pass (`forge test`), including an 8,192-call
  invariant fuzz run that never found the contract short of money.
  - Feeless, hard-capped in code (`MAX_FEE_BPS = 0`) — there is no owner knob
    that can ever charge a fee.
  - Upfront payment is gated by artisan level: New 0%, Trusted ≤30%, Pro ≤50%,
    checked at both `propose` and `fund`.
  - `verifier` role attests identity (GitHub/X) only — it cannot move money.
  - Admin (`owner`) can only: change `feeBps`/`max` for **new** jobs (fee is
    capped at 0 regardless), pause **new** `propose`/`fund` calls, and change
    the `verifier` address. It can never touch escrowed funds and
    `renounceOwnership()` is disabled (reverts on purpose) — nobody can leave
    the contract ownerless.
- **Backend** (`app/web/`, Next 16 + viem + libsql): 49 vitest tests pass.
  Routes exist for auth (Circle), jobs/escrow actions, tips, follows, posts,
  search, notifications, agent registration, badges, and a keeper endpoint.
  All of it currently points at **demo data** (`src/lib/demo.ts`,
  `src/lib/requests.ts`) in the UI — the API routes are real and tested, but
  no screen is wired to call them yet. That wiring is the single biggest
  remaining task (Phase 1 below).
- **UI**: every screen from sign-up to settings/agents is built, in dark and
  light mode, phone and laptop layouts, with the 12 "fun" motion details from
  the last round. tsc/eslint clean, `next build` succeeds.
- **Repo**: `C:/Users/HP/Arctisan`, git `main`, remote `kazzysax/arctisans`
  (private). All work described above is committed and pushed.

## 2. Credentials the user still needs to get (nothing below works without these)

Ask the user for these before starting Phase 1. Don't guess at values, don't
fabricate placeholders beyond what's already in `app/web/.env.example`.

1. **Circle mainnet API key** — console.circle.com → make sure the account
   has **Mainnet** access (not just sandbox), create a Wallets (W3S) API key,
   and create a **Gas Station policy** for Arc so user transactions are
   sponsored. Needs `CIRCLE_API_KEY` and `NEXT_PUBLIC_CIRCLE_APP_ID`.
2. **~$5 of USDC on Arc mainnet**, in a wallet the user controls, to fund the
   deployer and the keeper wallet with gas.
3. **Neon** (or Turso/libsql) database URL + auth token → `DATABASE_URL`,
   `DATABASE_AUTH_TOKEN`.
4. **Pinata** JWT for image storage → `PINATA_JWT` (dev falls back to local
   disk if unset, but you need this for production).
5. **Resend** (if email code delivery outside Circle is used — check whether
   Circle's own email OTP covers this before adding Resend; don't add an
   unused dependency).
6. **A domain**, and a decision: **Vercel vs Railway** for hosting. Cerebra
   already uses Railway, so default to Railway unless told otherwise.
7. **Google OAuth client** if Circle's Google sign-in requires your own
   client ID (check Circle's docs for this project's SDK version first).

## 3. Phase 1 — Wire the UI to the real backend (do this first)

The API routes already exist and are tested; the job is replacing demo-data
reads in the UI with real fetches, and wiring the write actions. Rough order:

1. **Auth**: `/signup` → Circle email/Google flow → `POST /api/auth/circle` →
   session cookie. Add a logged-out redirect guard in `AppShell`.
2. **CV setup** (`/setup`): save to `profile` table via a new or existing
   route (check `api/profile/route.ts` first — it may already support this).
3. **Feeds**: replace `discover`/`following` reads in `/social` and
   `requestById`/`REQUESTS` in `/search` and `/requests/[id]` with
   `api/posts`, `api/search`, and whatever request-listing route exists (add
   one if missing — there's no dedicated `/api/requests` route yet, only
   `jobs`/`v1/jobs`; check before building a duplicate).
4. **Profile**: `/u/[handle]` already has a real query (`getCard` in
   `lib/queries.ts`) for reputation/badges — wire it in instead of `people`/
   `profileOf` demo lookups.
5. **Money actions**, each signed through the Circle wallet (`lib/tx.ts` has
   the call-encoding helpers — `esc(...)` builds the calldata, you still need
   a signing round-trip through Circle's SDK):
   - propose → accept → fund (hire/[handle] → jobs/[id])
   - start → post update → deliver → approve / revision
   - settlement: offer split, accept split
   - tips (already has `api/tip`), reviews, withdraw a stuck payout
6. **Wallet card**: real USDC balance (Circle balances endpoint) + add
   funds/withdraw.
7. **Notifications**: wire `api/notifications` instead of the demo list.
8. **Keeper**: `lib/keeper.ts` + `api/cron/index` already compute due jobs and
   can poke the contract with `KEEPER_PRIVATE_KEY`. Just needs: that env var
   set, and a scheduled trigger (Vercel Cron, Railway cron, or an external
   pinger hitting `/api/cron/index` with `CRON_SECRET`).

Test each wired screen in Chrome against the real contract on **testnet**
before moving to Phase 2 — don't wire against mainnet directly.

## 4. Phase 2 — Safety checks (self-serve, not a full audit)

The user explicitly does not want a formal audit in this pass. Do these
cheaper checks yourself before mainnet:

- `forge test` and re-run the invariant fuzz test with a higher run count
  (`--fuzz-runs 50000` or bump `[invariant] runs` temporarily) — look for any
  new revert path introduced since the last change.
- `forge coverage` — make sure every public function in `ArctisanEscrow.sol`
  and `ArctisanSocial.sol` has at least one test touching it, especially the
  newer level-gating code (`propose`/`fund` upfront checks).
- Re-read `ArctisanEscrow.sol` once end-to-end for: reentrancy on external
  calls (USDC transfer), integer rounding in split calculations, and any
  `onlyOwner` function that could be mistaken for one that touches escrowed
  funds (it must not — see the admin limits in section 1).
- Confirm `MAX_FEE_BPS == 0` and `renounceOwnership()` reverting are both
  still covered by a test (grep `test/Escrow.t.sol` for `MAX_FEE` and
  `renounce`).
- Note any findings in `docs/DECISION_RECORD.md` under a new "Phase 2 safety
  pass" heading so the later formal audit has a paper trail.

## 5. Phase 3 — Deploy straight to Arc mainnet (no testnet audit gate)

1. **Testnet rehearsal first anyway** — not an audit, just a functional
   dry run so a mainnet deploy isn't the first time the contract runs for
   real:
   ```
   cd app/contracts
   RPC=<arc-testnet-rpc> PRIVATE_KEY=<deployer-key> OWNER=<owner-address> \
     forge script script/Deploy.s.sol --rpc-url $RPC --broadcast
   ```
   Then run through propose → fund → deliver → approve, and a settlement
   split, manually in the running dev app pointed at testnet addresses.
2. **Mainnet deploy**, same command with a mainnet RPC and a funded
   deployer key. Record the three `console.log` outputs
   (`ESCROW_ADDRESS`, `SOCIAL_ADDRESS`, `START_BLOCK`).
3. **Set production env** (Vercel/Railway dashboard, not committed):
   `RPC_URL` (mainnet), `ESCROW_ADDRESS`, `SOCIAL_ADDRESS`, `START_BLOCK`,
   `CIRCLE_API_KEY`, `NEXT_PUBLIC_CIRCLE_APP_ID`, `DATABASE_URL`,
   `DATABASE_AUTH_TOKEN`, `PINATA_JWT`, `KEEPER_PRIVATE_KEY` (a fresh wallet,
   gas-only, holding none of the escrowed funds), `CRON_SECRET`, `APP_SECRET`
   (new random 32+ bytes for production — never reuse the dev dummy one).
4. **Call `setVerifier`** on the deployed `ArctisanEscrow` from the owner
   wallet, pointing at whichever backend key signs verification attestations
   (`lib/level.ts` / the verify flow added in `/settings/verify`).
5. **Schedule the keeper** to hit `/api/cron/index` (with `CRON_SECRET`) on
   an interval — every few minutes is fine, the contract logic is idempotent.
6. **Smoke test on mainnet with real but tiny amounts** ($1, the contract
   minimum) before announcing: propose → fund → deliver → approve, and
   separately a 3-day-silence and a 48-hour-deadlock path if you can simulate
   time (you can't warp mainnet time, so these two just need to be verified
   by reasoning + the passing contract tests, not a live replay).
7. **Make the repo public** and write the grant submission (description +
   builder profile + a short demo video of the real app). Deadline is
   **Oct 14 23:59 ET / Oct 15 04:59 Lagos** — leave at least a day of buffer,
   so aim to be submission-ready by Oct 12–13.

## 6. Still open / explicitly deferred

- **Security audit**: deferred by the user, to be resumed here later. Don't
  start one unless asked.
- **Official logo**: user said they'd send it; swap into `Logo.tsx`,
  `/signup`, `/welcome`, the tab bar, and `api/og/u/[handle]` share cards
  wherever this placeholder mark currently appears.
- **Cheerful-but-professional restyle**: discussed but user said "leave it as
  it is" for now — ten concrete suggestions are in chat history if revisited
  (warm light mode default, more blue accent surfaces, more human photos,
  serif italic in headlines, warmer copy, soft shadows, tinted category
  tiles). Don't restyle unless asked again.
- **Missed-deadline rule**: still an open product question (reputation-only
  consequence, or something stronger?).
- View-transition morph (idea #2 in the fun pass) was built but not
  confirmed working in a real browser pass — verify it actually animates
  before relying on it in a demo video.

## 7. Key paths and commands

- Repo: `C:/Users/HP/Arctisan` — `app/contracts` (Foundry), `app/web` (Next).
- Tests: `cd app/web && CI=1 npx vitest run` · `cd app/contracts && forge test`
- Type/lint: `npx tsc --noEmit && npx eslint src` (run from `app/web`)
- Build: `cd app/web && APP_SECRET=<32+ chars> npx next build`
- Dev: `cd app/web && npx next dev -p 3060`
- Deploy script: `app/contracts/script/Deploy.s.sol` (see Phase 3 above)
- Env template: `app/web/.env.example` — copy to `.env.local` for dev, never
  commit real values.
- Chain id 5042, Arc; USDC is also the gas token (~1¢/tx); Circle sponsors
  gas via Gas Station so end users pay nothing.


---
## Update (Oct 2, later) — money flow wired

Done since the sections above:
- `lib/circle.ts` + `lib/walletClient.ts`: Circle sign-in and transaction approval helpers (server + browser).
- Hire screen sends a real agreement (`POST /api/jobs`, then the wallet approves the propose call).
- Invoice `/jobs/[id]` reads real job data (`GET /api/jobs/[id]` now returns parties, released, split offer, settlement deadline, timeline) and runs accept / fund / start / update / deliver / approve / revise / split / accept split / review.
- Tip sheet posts to `/api/tip` and approves the call.
- Lint is clean of errors (6 warnings remain).

**Verified:** tsc, eslint (0 errors), 49 tests, `next build`, and the invoice rendered in Chrome from a seeded database as client and artisan (right actions per role and state).
**NOT verified:** anything that needs a live Circle key. Sign-in, wallet creation, signing and the transaction-hash lookup have never run against Circle. First job when keys exist: run one full job on testnet and fix whatever Circle returns that the code did not expect.
**Still on demo data:** feed cards, stories, post and request pages, agents console, welcome.

---
## Update (Oct 3) — LIVE on mainnet, state at end of session

**Live:** https://arctisans.vercel.app (Vercel project `arctisans`, team kazzysaxs-projects; deploy with `cd app/web && vercel deploy --prod --yes`).
**Contracts (Arc mainnet, chain 5042):** see `docs/DEPLOYMENT.md`. Escrow `0x9D37…Efb6`, Social `0xE408…C2b2`, owner = deployer wallet `0x7D7f…A1D8`.
**Env:** all in Vercel production + `app/web/.env.local` (gitignored). Turso (DB), Pinata (images, gateway set), Circle mainnet key + App ID, Google client ID, generated APP_SECRET/CRON_SECRET.

**Verified working live:** Google sign-in (Circle social login) creates a Circle user and reaches /setup; Turso tables exist; Pinata upload + gateway fetch works.
**Fixed today:** CV setup lost name/handle between steps (fields now in state; deployed, not yet re-tested by the user on a real save).

**Still to do, in order**
1. User re-runs CV setup on phone; confirm profile row in Turso + avatar on Pinata.
2. Circle Console: save OTP email settings (SMTP via Resend works; the branded template would not save — default template is fine). Subject must use `{{code}}` (two braces).
3. Circle Gas Station policy for Arc (card + daily cap) — needed for gasless sends.
4. Generate verifier wallet; `setVerifier` on escrow (needs the owner key — do NOT reuse the key that was pasted in chat; move ownership to a fresh wallet first).
5. Keeper: cron hitting `/api/cron/index` with `CRON_SECRET` every 5–10 min (cron-job.org or GitHub Actions) + a funded keeper wallet.
6. Run one real $1 job end to end (propose → fund → deliver → approve). Circle transaction signing and tx-hash lookup have never run against live Circle.
7. Google: add Branding fields and Publish app (currently Testing; add test users meanwhile). Add a privacy page if Google insists.
8. Remaining demo-data screens (feed cards, stories, post/request pages, agents console, welcome).
9. Audit (deferred by the user), explorer source verification, domain, official logo swap (leaf mark A is in place meanwhile: `components/Logo.tsx`, `app/icon.svg`).

**Security note:** the deployer private key was pasted in chat on Oct 2. Treat it as exposed; rotate ownership after step 4.
