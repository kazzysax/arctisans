# Arctisans — Decision Record

Follows `PRODUCT_BUILDING_PLAYBOOK.md`. Source spec: `ARC_BUILD_RECORD_Arctisans_PredictionPool.md`.

## Phase 1, Step 1: context (checked Oct 2, 2026)

- **Context:** grant program, Arc Microgrants (Circle / Arc), DoraHacks. Live page saved as `arc_microgrants_page.md`.
- **Prize:** 20 × 500 USDC on Arc, non-dilutive.
- **Deadline:** Oct 14, 2026, 23:59 ET (Oct 15, 04:59 Lagos). Rolling review, so earlier submissions are answered earlier. All decisions by Oct 21.
- **Submission needs:**
  - a live deployment on Arc mainnet, with a link reviewers can open
  - a public repo
  - a short description of what it does and what it uses Arc for
  - a public builder profile (GitHub, X or Farcaster). This is **new**; it isn't in the build record.
- **Reviewers look for:** relevance to Arc, technical credibility, build quality, and whether it's worth taking further. "Promise counts for more than traction."
- **Not eligible:** mockups, slide decks, testnet-only builds, projects with no Arc component, work already funded by Circle or Arc.
- **Resolved open decision:** "Teams can submit more than one distinct project." Arctisans and Prediction Pool can each be submitted.

## Step 2: idea discussion

- **Name:** Arctisans (with an s). Confirmed by the owner.
- **Plan:** define the full scope and do the implementation research tonight (Oct 2), then build Oct 3.
- **Scope proposal:** tiers 1, 2 and 3 (see the chat on Oct 2). Waiting for the owner to confirm the tiers and answer the questions.

## Product definition v3 (owner answers, Oct 2)

- **Arctisans** = a profile, hiring and payment platform for skilled humans and AI agents, with proof onchain.
- **"Architects"** = people building on Arc or using it (Arc builders). Not real-world architects.
- **ASPs** = Agent Service Providers (AI agents). They can be hired AND can hire, both humans and other agents.
- **Humans in v1:** remote workers, freelancers, digital creators, writers, Arc builders.
- **Tailors:** recommendation is to keep them as a service; the client confirms the handover and nothing is shipped. Waiting for the owner to confirm.
- **Vendors:** owner proposes removing them for v1 (no product sales, no shipping). Recommended: yes.
- **Core features:**
  - auto-built CV at sign-up (bio, scope of work, skills, portfolio, LinkedIn/X/GitHub; for agents, marketplace stats that can be traced)
  - pictures only, no video
  - skill display
  - tips
  - escrow agreements
  - verifiable onchain invoices
  - reputation built from facts

## Questioning round 1: owner answers (Oct 2)

- **A1. Sign-up:** sign up with a form, then a designed CV page is generated.
- **A2. Links:** regular social and job-site links (LinkedIn, TikTok, X, GitHub, portfolio site, etc.) shown on the CV. No importing.
- **A3. One account:** can both hire (buy) and work (sell). Agreed.
- **A4. Arc names:** not needed.
- **B5. Agents:** use the API. The owner registers the agent and sets a spending limit.
- **B6. Agent funds:** linked to an owner wallet by default; optionally the agent manages its own funds.
- **B7. Agent stats:** no specific marketplace yet. Arctisans needs its own agent framework (research ERC-8004 etc. tonight).
- **C8. Pictures:** max 3 per post, compressed.
- **C9. Posting:** registered Arctisans only. Two feeds proposed (Work feed + Requests feed); waiting for the owner to confirm.
- **D10. Tips:** $1 / $2 / $5 / custom, min $0.50. **D11.** Agents can tip.
- **E12. Payment split:** chosen per agreement. Default 50/50 (50% released on start/acceptance, 50% on delivery); milestones optional, in v1.
- **E13. Agreed rules:** before the invoice is created, both parties agree preset rules (deliverables, revisions, deadline, what counts as done, what happens on a dispute). The rules are part of the invoice.
- **E14. Inactivity:** if one side shows no progress or update for 3 days, funds return (client side) / release (artisan side) per the rules.
- **E15. Invoice:** as proposed (parties, description fingerprint with the text kept privately, amount, deadline, status, receipts).
- **E16.** Feeless for now. **E17.** Max $100 per job.
- **F18. Reviews:** people AND agents leave reviews. Reputation is central; show every reputable detail.
- **G19. Feel:** premium and social.
- **G20. Device:** web app for phone and laptop.

## Payments and disputes (owner decisions, Oct 2)

- **Money split per job:** the parties decide; default 50/50, milestones optional.
- **Inactivity:** money returns to its original owner. Exception (agreed): a client who goes silent after delivery triggers settlement, not a refund.
- **Off-platform payment:** removed. Everything is paid in USDC on Arc.
- **No judge:** no admin judge and no jury. Disputes settle by mutual split offer, then by the pre-agreed deadlock rule (default 50/50 of the frozen part).
- **Themes:** dark AND light mode in v1.
- **Optional list:** the owner accepted all recommendations (search, follow, likes, in-app notifications, verified badge, revisions, cancel-before-start, share links, rate limits and caps, basic admin; leaderboard, messaging and cross-chain later).
- **Scope document:** `SCOPE_v1.md`.

## Sign-in and approval (Oct 2)

- **Sign-in:** email OTP + Google (Circle user-controlled wallets, SCA, Gas Station). Passkeys dropped from v1.
- **Agent wallets:** Circle developer-controlled wallets.
- **Email codes:** we send them ourselves through an SMTP provider (e.g. Resend).
- **Scope:** SCOPE_v1.md APPROVED. Phase 2 implementation research started.
