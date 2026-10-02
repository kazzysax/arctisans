# R3 — Smart contract design: escrow, invoices, tips, reviews (Arc mainnet)

Status: research draft (2026-10-02). Nothing deployed. Companion sketch: `R3_sketch.sol`
(compiles with forge 1.7.1 / solc 0.8.30 / OZ v5.7.0, `via_ir`; 5 unit tests + 1 invariant pass in
`research-scratch/r3`). **Unaudited. Do not deploy it as written.**

## 1. Contracts (two, no upgradeability)

| Contract | Holds funds? | Responsibilities |
|---|---|---|
| `ArctisanEscrow` | Yes (only escrow) | Agreements (terms hash), invoices, funding, 50/50 or milestone releases, 3-day silence timers, settlement and 48h deadlock, cancel, cap and fee params, a pull-credit fallback. |
| `ArctisanSocial` | **Never** | Profile registry (wallet → IPFS CID, isAgent, owner), post-hash publishing, tips (`transferFrom` straight from tipper to artisan), reviews gated by `escrow.isReviewable()`. |

- An "invoice" is a job **proposed by the artisan**. The client accepts it by calling `fund()`, so there is no separate invoice contract.
- Agents use the same functions. `isAgent` and `owner` only label the wallet for reputation. They grant no privileges.
- Immutable, non-proxy deployment. "Nobody judges" holds only if no upgrade path exists. Ship v2 as a new contract and let v1 drain naturally.
- OZ v5.7.0 (latest release, 2026-07-29): `SafeERC20` (`safeTransferFrom`, `trySafeTransfer`), `ReentrancyGuardTransient` (Arc is Osaka-baseline, so EIP-1153 is available), `Ownable2Step`, `Pausable`.

## 2. Job state machine

States: `Proposed → Agreed → Funded → Active ⇄ Delivered → {Completed | Settlement → Settled | Deadlocked}`,
plus `Abandoned` and `Cancelled`. **Terminal:** Completed, Settled, Deadlocked, Abandoned, Cancelled.
`clockStart` is a single timestamp that means lastUpdate in Active, deliveredAt in Delivered, and settlementStart in Settlement.

| From | Call | Who | Guard | To / effect |
|---|---|---|---|---|
| — | `propose(client, artisan, termsHash, upfront, milestones[], deadline, revisions, deadlockRule)` | client or artisan | sum ≤ `maxJobAmount` (default $100), 1–10 milestones, no zero milestones, client ≠ artisan | Proposed. Proposer counts as having agreed. Fee bps is snapshotted. |
| Proposed | `agree(id, termsHash)` | artisan (if client proposed) | hash must match | Agreed |
| Agreed, or Proposed with artisan agreed | `fund(id, termsHash)` | client | hash matches; prior `approve` | Funded. 100% is pulled in. Funding counts as the client's acceptance. |
| Proposed / Agreed / Funded | `cancel(id)` | either party | not started | Cancelled. Full refund if funded. **Works while paused.** |
| Funded | `start(id)` | artisan | — | Active. `upfront` released (the default plan is 50%). Clock starts. |
| Active | `postProgress(id, updateHash)` | artisan | now ≤ clock+3d | Clock resets |
| Active | `deliver(id, deliveryHash)` | artisan | now ≤ clock+3d | Delivered. Emits `onTime = now ≤ deadline`. |
| Delivered | `requestRevision(id, noteHash)` | client | now ≤ clock+3d, used < allowed | Active. `revisionsUsed++`, clock resets. |
| Delivered | `approveDelivery(id)` | client | (allowed even late, because it only helps the artisan) | Releases the milestone and goes back to Active. The last milestone releases `total − released` and ends in Completed. |
| Active (expired) | `poke(id)` | **anyone** | now > clock+3d | Abandoned. Unreleased funds go back to the client (rule 5a). |
| Delivered (expired) | `poke(id)` | **anyone** | now > clock+3d | Settlement, reason 1. No free refund (rule 5b). |
| Active / Delivered | `openSettlement(id)` | either party | timer not expired | Settlement, reason 0 |
| Settlement | `offerSplit(id, toArtisan)` | either party | ≤ frozen, within 48h | Overwrites any previous offer |
| Settlement | `acceptSplit(id, toArtisan)` | the **other** party | echoes the amount; within 48h | Settled. Pays out instantly. |
| Settlement (expired) | `poke(id)` | **anyone** | now > clock+48h | Deadlocked. The rule applies: 50/50 (odd micro-unit to the client), ToClient, or ToArtisan. |

Notes:
- `frozen = total − released`. With the default plan this is the second 50%, because the upfront is already paid out.
- Deadline misses don't move money. They only feed `onTime` for reputation. That keeps the rules to exactly the 10 agreed ones.
- Once revisions run out, the client's only choices are approve, settlement, or silence (which also leads to settlement). That is "revisions count in terms".
- `acceptSplit` must echo the amount. Without that, an offerer could front-run by swapping in a worse offer just before acceptance.
- In the sketch, `offerSplit` only keeps the latest offer and nobody can withdraw one. That is acceptable because the window is only 48h.

## 3. Data structs (6-dec USDC; uint96 covers 7.9e22 units, far above any cap)

```solidity
struct Job { address client; uint64 deadline; uint8 revisionsAllowed, revisionsUsed, nextMilestone, milestoneCount;
             address artisan; Status status; DeadlockRule deadlockRule; uint16 feeBps; bool artisanProposed, clientAgreed, artisanAgreed;
             uint96 total; uint96 released; uint64 clockStart;
             uint96 upfront; uint96 offerToArtisan; address offerBy; bytes32 termsHash; }
mapping(uint256 => uint96[]) milestones;   // released on each approveDelivery; last one absorbs rounding
mapping(address => uint256) owed;          // pull fallback when a push fails
Social: struct Profile { string cid; address owner; bool isAgent; }  mapping(jobId => reviewer => bool) reviewed;
```

- **`termsHash`** is `keccak256` of a canonical JSON agreement (RFC 8785 JCS). The JSON holds the scope, deliverables, revisions, the money plan, the deadlock rule, and both wallets, plus a salt so the hash can't be brute-forced. The full text stays private off-chain. Either party can later prove the text by revealing it.
- **The default plan** is encoded as `upfront = total/2` with `milestones = [total − total/2]`. Custom plans set `upfront` (which may be 0) and N milestones. The money-plan fields are also inside the hash, so the contract arguments and the signed terms can be cross-checked.

## 4. Events (the indexer and reputation are rebuilt from events alone)

`JobProposed(id, client, artisan, proposer, termsHash, total, upfront, milestones[], deadline, revisions, rule, feeBps)`,
`TermsAgreed(id, by, termsHash)`, `JobFunded(id, client, amount)`, `JobStarted(id, artisan, at)`,
`ProgressPosted(id, artisan, updateHash)`, `Delivered(id, artisan, milestone, deliveryHash, onTime)`,
`RevisionRequested(id, client, used, noteHash)`, `Released(id, to, milestone, net, fee)` (milestone 255 = upfront, 254 = split),
`Refunded(id, to, amount)`, `SettlementOpened(id, by, reason, deadlockAt)`, `SplitOffered(id, by, toArtisan, toClient)`,
**`JobClosed(id, client, artisan, outcome, paidToArtisan, refundedToClient, onTime)`**, which is the single reputation row per job,
`PayoutDeferred(to, amount)`, `ParamsChanged(...)`, and from Social: `ProfileSet`, `PostPublished(author, postHash, cid)`,
`Tipped(from, to, postHash, amount)`, `Reviewed(jobId, reviewer, subject, rating, reviewHash)`.

- **Reputation per wallet:**
  - completed jobs = count of `JobClosed.outcome == Completed`
  - on-time = `onTime` flag (also per milestone through `Delivered`)
  - splits = `Settled`
  - deadlocks = `Deadlocked`
  - abandoned = `Abandoned`. `SettlementOpened.reason == 1` marks a silent client.
- **`by` fields:** `poke()` emits `by = msg.sender`, but the indexer should attribute fault from the state and reason, not from whoever poked.
- **Indexing:** filter by our contract address and our topics. Do **not** derive amounts from USDC `Transfer` logs. On Arc each ERC-20 movement also shows up as an EIP-7708 log from the system emitter `0xffff…fffE` at 18 decimals, so you would double count. [arc: usdc-system-events, indexing-events]

## 5. Timers (3-day silence, 48h deadlock)

- **No keeper is required for correctness.** Every timeout is enforced lazily:
  - Once a timer expires, the time-guarded actions revert (`postProgress`, `deliver`, `requestRevision`, `openSettlement`, `offerSplit`, `acceptSplit`).
  - The only way forward is `poke(id)`, which is permissionless. That gives a deterministic outcome no matter who calls it or when.
- **Who pokes:**
  - The party that benefits (the client for 5a, the artisan for the deadlock rule) gets a "Claim" button in the UI.
  - A backend cron, the **Arctisans keeper**, also scans indexed `clockStart + window` and pokes, paying gas from a small ops EOA. Arc gas is cheap in USDC, and the EWMA base fee has a 20 gwei floor. [arc: gas-and-fees]
  - The keeper is a convenience only. It has no special rights, so it can't judge.
- **Late moves:** a late `approveDelivery` is still allowed until someone pokes, because it only helps the counterparty. A late `postProgress` is **not** allowed, otherwise the artisan could revive a job after the refund right accrued.
- **Timestamps:** use `block.timestamp`. Arc timestamps are non-decreasing (not strictly), and blocks are sub-second under PoA. Skew of a few seconds is irrelevant against 3d/48h windows. Comparisons are strict (`>`). Never use `PREVRANDAO` (it is always 0). [arc: evm-differences]

## 6. Security checklist

- [x] **No admin fund path.** Owner functions are limited to `setParams` (cap, fee ≤ `MAX_FEE_BPS = 500`, fee recipient), `pause`, and `unpause`.
  - Fee bps, rule, and amounts are **snapshotted per job**, so a parameter change never affects funded jobs.
  - There is no `rescue`/`sweep` of USDC. If a stray-token rescue is ever added, it must exclude USDC.
  - `renounceOwnership` is disabled; ownership moves via `Ownable2Step` to a multisig.
- [x] **Pause cannot trap funds.** `whenNotPaused` covers only `propose` and `fund`. `cancel`, `start`, `deliver`, `approveDelivery`, `poke`, settlement, and `withdrawOwed` always work. This is tested.
- [x] **Reentrancy.** USDC is not a hook token, but `nonReentrant` (transient) guards every function that moves money. State is written before transfers (checks-effects-interactions).
- [x] **Push payment with pull fallback.**
  - Payouts use `trySafeTransfer`. On failure, the amount is credited to `owed[to]` and `PayoutDeferred` is emitted.
  - Failures can come from the USDC blocklist, a Circle pause of USDC, or a reverting recipient. With the fallback, one blocklisted party can't freeze the other party's refund or the job state.
- [x] **Rounding (6 decimals).** The last milestone and splits use `total − released`, so the remainder always lands somewhere.
  - The 50/50 deadlock gives `frozen/2` to the artisan and the odd unit to the client.
  - The fee is `gross*bps/10000`, rounded down in the artisan's favour.
  - The minimum job is 1 micro-unit. Consider enforcing a minimum of $1.
- [x] **Amounts.** All amounts are in 6-dec ERC-20 units through `0x3600…0000`. **Never** use `msg.value`, `address(this).balance`, or `payable`: the native balance is the *same* USDC at 18 decimals, off by 10¹². [arc: evm-differences, contract-addresses]
- [x] **Zero address.** `address(0)` recipients are rejected. On Arc, value sends to 0x0 revert. [arc: evm-differences]
- [x] **Signatures.** Agreement acceptance is an on-chain tx (`agree`/`fund` with `termsHash`), not a signature. This avoids `ecrecover` failing for SCAs. If off-chain sigs are ever needed, use OZ `SignatureChecker` (ERC-1271), which still breaks for counterfactual (undeployed) SCAs.
- [x] **Front-running.** `acceptSplit` echoes the amount. `fund` and `agree` echo `termsHash`, which prevents a bait-and-switch through a re-proposal (jobs are immutable after `propose` anyway).
- [x] **Griefing.** Spam `propose` calls cost the spammer gas and lock no funds. A client can't be forced to fund. The client always gets an exit before `start`.
- [x] **Fee-on-transfer and odd ERC-20s** are N/A, because `usdc` is immutable and fixed to Arc USDC.
- [ ] **Open questions:**
  - Should `cancel` by the client after `Funded` be allowed while the artisan is mid-acceptance? A race is acceptable: whichever tx is first wins, and finality is under 1s.
  - Review-bombing: only the two parties of a terminal job can review, once per direction. Should a `Cancelled` job be reviewable? Currently no (it was never paid).
- **Lessons from prior art:**
  - **Circle `refund-protocol`** (github.com/circlefin/refund-protocol) is arbiter-based and *unaudited*. Its README carries a security notice: "early withdrawal function … allows an arbiter to drain other user's payments". This supports our no-arbiter and no-early-withdraw design.
  - **Kleros `MultipleArbitrableTransaction`** offers the timeout-by-either-party and "anyone executes after timeout" idioms. That is a pattern reference only; we removed the arbitrator.

## 7. Test plan (Foundry; use Arc Foundry `arc-forge`/`arc-anvil` for fork tests)

1. **Unit tests (one per transition and revert path):**
   - Every row of §2, with the wrong caller, wrong state, wrong hash, before and after each timer (exactly `t`, `t+1`).
   - Cancel refunds and pause behaviour.
   - Cap boundary (100e6 passes, 100e6+1 reverts).
   - Fee 0, 500 bps, and >500 reverts.
   - Milestone sums and the last-milestone remainder.
   - Revision exhaustion.
   - Review gating: non-party, duplicate, cancelled job.
   - Tip below $0.50 reverts.
   - Profile agent and owner.
2. **Fuzz tests:**
   - Amounts in [1, cap] and 1–10 milestones: Σ payouts + refunds == total exactly, for every terminal path.
   - Split offers in [0, frozen].
   - Fee bps in [0, 500].
   - Warp offsets around 3d and 48h.
3. **Invariants (handler-based; the sketch already runs a version):**
   - **`usdc.balanceOf(escrow) == totalLocked + totalOwed`**, where `totalLocked` = Σ unreleased escrow over all non-terminal funded jobs. Also compute that sum independently by iterating the handler's ids, as a ghost variable.
   - Terminal jobs have `released + refunded == total` and never change state again.
   - `released` is monotonic.
   - The owner (handler actor) can never change any party's balance.
   - Pause never makes a terminal state unreachable.
4. **Blocklist simulation:** a mock USDC that reverts for listed addresses, confirming that payouts defer to `owed` and the other party is paid. This is already passing in the sketch.
5. **Fork test** against Arc testnet with `arc-anvil`. It covers the real `0x3600…` USDC, `transferFrom` through an SCA `executeBatch`, and event decimals.
6. **Before mainnet:** Slither and Aderyn clean, 100% branch coverage, an external review or audit (even a lightweight one), and a testnet soak with the keeper.

## 8. Funding flow with Circle SCA wallets (approve + fund, batched)

- **Rejected options:**
  - EIP-2612 `permit`: signature validation from an SCA isn't reliable.
  - `transferWithAuthorization` (EIP-3009): same SCA problem, and it doesn't fit pull-into-escrow.
- **SCA / MSCA (Circle wallets):** every SCA exposes `executeBatch((address target,uint256 value,bytes callData)[])`. Use `POST /user/transactions/contractExecution` (or the developer endpoint) with `abiFunctionSignature: "executeBatch((address,uint256,bytes)[])"` and two subcalls:
  `[ (USDC, 0, approve(escrow, total)), (escrow, 0, fund(id, termsHash)) ]`. The batch is atomic: one user approval, one tx. [circle: wallets/batch-operations]
- **Tips:** `[approve(social, amt), social.tip(to, amt, postHash)]` as a batch. Alternatively a plain `USDC.transfer` plus a `PostPublished`-style log via Arc's Memo contract, but `tip()` keeps the record in our events.
- **Modular wallets (MSCA)** batch user operations through the modular SDK. Gas can be sponsored with an ERC-4337 paymaster funded in native USDC (18-dec). [arc: deploy-a-paymaster]
- **EOAs (e.g. external agents or MetaMask):** Arc's `Multicall3From` at `0x522fAf9A91c41c443c66765030741e4AaCe147D0` (mainnet and testnet) preserves the **EOA** as `msg.sender` through the `CallFrom` precompile. So `aggregate3([approve, fund])` works in one tx. It is documented for EOAs only, so don't use it from SCAs. [arc: batched-transactions, contract-addresses]
- **Approvals:** approve exactly `total`, never unlimited. That keeps the blast radius at one job.

## 9. Arc-specific gotchas (sources)

| Gotcha | Impact on us | Source |
|---|---|---|
| USDC is native gas (18 dec) **and** an ERC-20 at `0x3600…0000` (6 dec), with one shared balance | ERC-20 only, 6 dec; never mix with `msg.value`/`balance` | docs.arc.io/arc/references/contract-addresses.md, evm-differences.md |
| EIP-7708: the system emitter `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` logs native USDC Transfers | Indexer: rely on our events, de-dup USDC transfers | docs.arc.io/arc/references/usdc-system-events.md |
| `PREVRANDAO` always 0 | No on-chain randomness (none needed) | evm-differences.md |
| Timestamps non-decreasing, not strictly increasing | Use `>` windows; don't assume a unique ts per block | evm-differences.md |
| Blocklist enforced at runtime; reverting txs still burn gas | `trySafeTransfer` + `owed` fallback; preflight `eth_call` in the UI | evm-differences.md, integrate/infrastructure/compliance.md |
| Value send to `address(0)` or to a self-destructed account reverts | Validate recipients; no SELFDESTRUCT | evm-differences.md |
| Min base fee 20 gwei; txs below the floor are dropped with no receipt | Keeper/ops EOA must set `maxFeePerGas ≥ 20 gwei` | evm-differences.md, gas-and-fees.md |
| Sub-second deterministic finality | 1 confirmation suffices for indexer/UI | docs.arc.io/arc/concepts/deterministic-finality.md |
| Local `anvil` doesn't model Arc rules | Use Arc Foundry (`arc-forge`, `arc-anvil`) for fork tests | docs.arc.io/arc/tutorials/install-arc-foundry.md |
| Osaka EVM baseline | Transient storage (`ReentrancyGuardTransient`) OK; solc ≥0.8.24 | llms.txt / evm-differences.md |
| Opt-in privacy (Arc Privacy Sector) exists | Future: private terms on-chain; out of scope | docs.arc.io/arc/concepts/opt-in-privacy.md |

## 10. Next steps
1. Agree on: a $1 minimum job, whether `Cancelled` jobs are reviewable, and the deadline-miss policy (reputation only, versus a timer).
2. Turn the sketch into `contracts/` with the full §7 suite, then fork-test on Arc testnet through a Circle SCA batch.
3. External review before any mainnet deploy. Deploy immutable, with ownership held by a 2-of-3 multisig.
