# R2 — Agent identity & reputation for Arctisans (ERC-8004 and alternatives)

Researched 2026-10-02. Raw copies are in `docs/research/raw/` (erc-8004.md, erc-8183.md, erc8004-contracts-README.md, the three `*RegistryUpgradeable.sol` files, best-practices-Reputation.md, arc_*.md, circle_*.md, x402-README.md).
**Bottom line:** the official ERC-8004 registries are already live on Arc mainnet, so we don't need to deploy anything for identity or reputation. Arctisans should use them as they are. Our escrow contract becomes the only "clientAddress" Arctisans treats as verified, so a review only counts if a paid job sits behind it.

---

## 1. What ERC-8004 is now

**Findings**
- Name: "Trustless Agents". **Status: Draft** (Standards Track, ERC). Created 2025-08-13. Requires EIP-155/712/721/1271. Licence: CC0. Authors are from MetaMask, the EF, Google and Coinbase. [S1]
- The deployed implementations report `getVersion() = "2.0.0"`. I checked this with `eth_call` on Arc mainnet. [S5]
- Payments are explicitly out of scope ("orthogonal"). x402 shows up only as an optional `proofOfPayment` field in the feedback file. [S1]
- **Identity Registry**: an ERC-721 with URIStorage. `agentId` is the tokenId; the NFT owner owns the agent. The global ID is `eip155:5042:<identityRegistry>` plus `agentId`.
  - `register(agentURI[, MetadataEntry[]])`, `setAgentURI`, `getMetadata` and `setMetadata` (key → bytes).
  - Reserved key `agentWallet`: the address that receives payments. It defaults to the owner. Changing it with `setAgentWallet(agentId,newWallet,deadline,sig)` needs an EIP-712 or ERC-1271 signature from the new wallet. It is **cleared when the NFT is transferred**.
  - Events: `Registered`, `URIUpdated`, `MetadataSet`. [S1]
- **Registration file** (the agentURI target, which can be ipfs/https/data: URI) has `type`, `name`, `description`, `image`, `services[]` (web/A2A/MCP/OASF/ENS/DID/email…), `x402Support`, `active`, `registrations[]` and `supportedTrust[]`. Domain ownership can optionally be proved via `/.well-known/agent-registration.json`. [S1]
- **Reputation Registry**:
  - Write: `giveFeedback(agentId, int128 value, uint8 valueDecimals, tag1, tag2, endpoint, feedbackURI, feedbackHash)`. **Anyone can call it except the agent's owner or its operators.** The implementation enforces this with `isAuthorizedOrOwner`, which rejects self-feedback. [S1][S4]
  - Stored onchain: value, decimals, tag1, tag2, isRevoked, and a per-(agent, client) `feedbackIndex`. endpoint, URI and hash are emitted in events only.
  - Other writes: `revokeFeedback` (original client only) and `appendResponse` (anyone, e.g. the agent disputing a review).
  - Reads: `getSummary(agentId, clientAddresses[], tag1, tag2)`, where **clientAddresses is mandatory** "to resist Sybil/spam". Also `readFeedback`, `readAllFeedback`, `getClients` and `getLastIndex`. [S1][S4]
  - Convention: 1–5 stars map to `tag1="starred"` with value 20/40/60/80/100. [S6]
- **Validation Registry**: the agent owner calls `validationRequest(validator, agentId, requestURI, requestHash)`, then the named validator calls `validationResponse(requestHash, 0..100, …)`. The README says this part is **"still under active update and discussion with the TEE community"**. [S1][S3]
- The spec's own security section says: "Sybil attacks are possible … The protocol's contribution is to make signals public and use the same schema". Each consumer is expected to filter by trusted reviewers. [S1]

**Recommendation:** use Identity and Reputation now and skip Validation in v1, because that part of the spec is still changing.
**Risks:** this is a Draft ERC, so field names may change. It has already gone from v1 to "2.0.0". Keep the ABI behind an adapter in our code.

## 2. Deployment on Arc mainnet

**Findings**
- Arc's official contract-address page lists the ERC-8004 registries for **Mainnet** [S2]:
  - IdentityRegistry `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432`
  - ReputationRegistry `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63`
  - ValidationRegistry `0x8004Cc8439f36fd5F9F049D9fF86523Df6dAAB58`
  - Testnet: `0x8004A818…BD9e`, `0x8004B663…8713` and `0x8004Cb1B…4272`.
- These are the same vanity singleton addresses used on Ethereum, Base and others [S3]. Arc has a tutorial: "Register your first AI agent" (testnet, via Circle dev-controlled wallets) [S7].
- **I verified this myself against `https://rpc.mainnet.arc.io`** (chainId `0x13b2` = 5042):
  - All three addresses have code and are ERC-1967 proxies. The implementations are about 14.5 KB, 10.5 KB and 5.9 KB of runtime bytecode.
  - `getVersion()` returns "2.0.0".
  - `owner()` returns `0x547289319c3e6aedb179c0b8e8af0b5acd062603`, which has **no code** (it's an EOA). This is UUPS, so that one key can upgrade all three registries. [S5]
- Self-deploy option: the repo `erc-8004/erc-8004-contracts` is MIT in the SPDX headers and "CC0" in the README. It's built on OpenZeppelin upgradeable contracts, with sources of 213, 385 and 197 lines, and it ships a Hardhat setup and a vanity-deploy guide [S3][S4].
- **I found no published audit.** awesome-8004 says "auditors coming soon" [S8]. "Not audited" means none found, not confirmed.

**Recommendation:** don't deploy our own registries. Use the canonical Arc mainnet singletons, because that's what lets other platforms read our agents' stats.
**Risks:**
1. A single EOA can upgrade the registries. In theory a malicious upgrade could rewrite storage, so our backend should mirror the events as an independent record.
2. No audit was found.
3. The ERC-8183 escrow reference implementation (`AgenticCommerce` `0x0747…4583`) is listed only for **testnet** [S9]. ERC-8183 itself is also a Draft [S10].

## 3. Recommended design: onchain identity plus escrow-gated reviews

**Identity**
1. For each ASP, call `register(agentURI)` **from the human owner's wallet**. The owner holds the NFT, so a human stays accountable. Store `agentId` in our DB.
   - agentURI = `https://arctisans.xyz/agents/<id>/registration.json`, or IPFS for immutability.
   - It contains name, description, image, `services` (our profile URL, an A2A/MCP endpoint if the agent has one), `registrations: [{agentId, agentRegistry:"eip155:5042:0x8004A169…a432"}]` and `supportedTrust:["reputation"]`.
2. If the agent holds its own funds (Circle wallet):
   - The owner calls `setAgentWallet(agentId, agentAddr, deadline, sig)`.
   - The agent wallet produces `sig` with EIP-712 signTypedData. Circle wallets support signing EIP-712 typed data [S11].
   - Otherwise `agentWallet` stays as the owner.
3. Optional `setMetadata` keys such as `"arctisans:profile"`. Arctisans can sponsor gas, since it's paid in USDC (Gas Station / paymaster) [S12].

**Jobs and payout**
- An escrow job stores `agentId`, not just an address.
- On release, pay `IdentityRegistry.getAgentWallet(agentId)` as read at funding time and snapshotted, so a later NFT transfer can't redirect a funded job.

**Reviews that only count from paid jobs**
- The Reputation Registry is permissionless. We **cannot stop** strangers from writing feedback about our agents into it. What we control is **which clientAddress our UI trusts and publishes as "verified"**.
- Pattern: our `ArctisansEscrow` is the *only* contract that calls `giveFeedback`, so `clientAddress = escrow`:
  - `review(jobId, uint8 stars, string uri, bytes32 hash)`: callable once, only by `job.client` (or its delegate), only once the job is `Released` or `Completed`. The contract then calls `giveFeedback(agentId, stars*20, 0, "starred", "arctisans/v1", "", uri, hash)`. The URI and hash point to a JSON file with the review text, jobId, client wallet, release txHash (`proofOfPayment`) and amount.
  - On release, the escrow also writes signals automatically: `tag1="jobCompleted"` value 1, and `tag1="earnings"` value = amount with the matching decimals. That gives verifiable jobs-done and earnings from `readAllFeedback(agentId,[escrow],"jobCompleted",…)`. Tips can use `tag1="tip"`.
  - The **verified rating** is then `getSummary(agentId, [escrowV1, escrowV2…], "starred", "")`. Other platforms reproduce it by filtering on our escrow addresses. We publish those in our docs and in `/.well-known/arctisans-escrows.json`.
- Disputes: the agent replies with `appendResponse`. We never use `revokeFeedback` from the escrow except in a documented admin path (or not at all).
- The registry blocks the owner and operators from self-reviewing [S4]. The escrow must therefore never be approved as an operator of the agent NFT.

**Anti-fake-review measures beyond onchain gating**
- Wash trading (an owner hiring their own agent from a second wallet) can't be fully prevented onchain. Mitigations:
  - the platform fee makes it cost money;
  - a minimum job value before a review counts;
  - weight by unique client wallets and amount paid;
  - flag clients that are linked to the agent owner (funding graph, same login);
  - display "reviews from N distinct paying clients".
- **Reputation moves with the NFT.** Index `Transfer` events and show "ownership changed on <date>". `agentWallet` resets on transfer [S1].

**Risks:**
- Sending every review through one clientAddress (the escrow) means per-client analysis depends on our off-chain file. Put the client wallet in `tag2` or the JSON file.
- Changing the escrow address breaks the filter unless every version is listed.
- Gas per review is paid by whoever calls `review`.

## 4. Agent API design (v1)

**Auth**
- v1 uses **API keys**: a prefix plus a 32-byte random secret, stored as a hash, scoped (`read`, `jobs:write`, `payments:write`), rate-limited, rotatable and revocable from the owner dashboard. Each key is bound to `agentId`.
- For money-moving endpoints, also require **either**:
  - an HMAC of `(method, path, body-hash, timestamp, nonce)` with the key secret (to block replay), or
  - for self-custody agents, an **EIP-712 signature** from `agentWallet` over the intent: `{action, jobId, amount, nonce, deadline}`.
- Every POST takes an `Idempotency-Key`.
- Webhooks are signed with HMAC.

**Endpoints**
- Identity:
  - `GET /v1/me` returns the profile, agentId, owner, agentWallet, caps and balances.
  - `PATCH /v1/me` updates the profile; the backend rewrites the registration file and calls `setAgentURI` if needed.
- Marketplace:
  - `GET /v1/requests?skill=&min_budget=` browses requests.
  - `POST /v1/requests` posts work (the agent acting as a hirer).
  - `POST /v1/requests/{id}/proposals` bids on a request.
  - `POST /v1/services` lists a gig.
- Agreements:
  - `POST /v1/agreements` creates one with terms, price and deadline.
  - `POST /v1/agreements/{id}/accept`, `.../fund`, `.../deliver` (deliverable URI plus keccak hash, which goes onchain), `.../release` (client), `.../dispute`, `.../cancel`.
- Money and reviews:
  - `POST /v1/agreements/{id}/tip`
  - `POST /v1/agreements/{id}/review` (stars plus text; the escrow writes it onchain)
  - `GET /v1/agents/{id}/reputation` (verified summary plus onchain proof links)
- Events: `GET /v1/events` and webhooks for `agreement.*`, `payment.*` and `review.*`.

**Spending caps**
- **Owner-accountable agent (no own wallet)**: the agent never signs transactions. The backend executes through the owner's delegated mechanism and **enforces caps in the backend**: per-tx, daily and monthly, with an atomic DB counter checked inside the same transaction that queues the onchain call.
  - For a hard onchain bound, the owner gives `USDC.approve(escrow, cap)` and the escrow's `fundFor(owner, agentId, …)` pulls from that allowance.
  - Optionally the escrow keeps a `delegateCap[owner][agentId]` per period. The ERC-20 allowance is then the true ceiling, even if our backend is compromised.
- **Agent with its own wallet**:
  - With Circle developer-controlled wallets, Arctisans or the owner holds the keys and signs through the Circle API (`createContractExecutionTransaction`, as in Arc's tutorials [S7][S9]). Caps are enforced by our backend before calling Circle.
  - With Circle **Agent Wallets** (user-custody 2-of-2 MPC), policies such as `--per-tx/--daily/--weekly/--monthly` and allowlists are enforced by Circle, including on chain `ARC`. These work on mainnet only, and changes need an email OTP [S13][S14].
  - The escrow address should be allowlisted.
- Recommended layering: backend caps (always) + ERC-20 allowance or escrow cap (hard limit) + Circle policy (if the agent uses an Agent Wallet).

**x402**: not needed for escrowed jobs. It's useful later for pay-per-call agent services. Circle runs an x402 facilitator on Arc [S15][S16].
**Risks:** a leaked API key can spend up to the cap, so keep caps low by default, add IP allowlists, and alert the owner. Also, Arc's native USDC uses 18 decimals while the ERC-20 interface uses 6, so stick to one unit in the API [S2].

## 5. Alternatives if ERC-8004 is a poor fit

| Option | Pros | Cons |
|---|---|---|
| **A. Canonical ERC-8004 on Arc (recommended)** | Already deployed and in Circle's docs; other platforms index it; no audit or deploy work for us | Draft spec; registries upgradeable by one EOA; permissionless writes mean a filtered view is needed |
| B. Self-deploy 8004 reference contracts we own | Same ABI, so tools still work; we control upgrades (or deploy non-upgradeable) | Not the canonical singleton, so cross-platform discovery suffers; we pay for an audit (none found) |
| C. Our own minimal `ArctisansReputation` that emits 8004-shaped events (`Registered`, `NewFeedback`) with writes allowed only from the escrow | Strongest anti-spam (gated writes); tiny surface; immutable | Non-standard addresses, so other platforms must integrate us specifically; "compatible events" don't make it 8004-conformant |
| D. Off-chain only (DB plus signed receipts or Merkle root anchored periodically) | Cheapest and most flexible | Weak external verifiability; trust in Arctisans |
| E. Escrow as ERC-8183 job contract + hook that writes 8004 feedback on `complete` (pattern named in the spec) [S10] | Standard job lifecycle that other agent platforms understand | Draft created Feb 2026; the Arc reference implementation is on testnet only; evaluator-role model needs mapping to our dispute flow |

**Recommendation:** go with A now. Make our escrow's shape close to ERC-8183 (createJob/fund/submit/complete/reject, `deliverable` bytes32), so we can adopt E later. Keep C as the fallback if the canonical registries get spammed or upgraded in ways we can't accept. Our escrow-filtered reads work the same way in both.

## Open questions / not verified
- No audit report for the erc-8004-contracts was found. I didn't check who controls `0x5472…2603`.
- I didn't check whether EAS (Ethereum Attestation Service) is deployed on Arc.
- I didn't check whether Circle **developer-controlled** wallets (as opposed to Agent Wallets) have native per-wallet spending policies; I assumed backend enforcement.

## Sources
- [S1] ERC-8004 spec: https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-8004.md (raw/erc-8004.md)
- [S2] Arc contract addresses: https://docs.arc.io/arc/references/contract-addresses.md (raw/arc_arc_references_contract-addresses.md)
- [S3] https://github.com/erc-8004/erc-8004-contracts README (raw/erc8004-contracts-README.md)
- [S4] Reference implementation sources: raw/IdentityRegistryUpgradeable.sol, ReputationRegistryUpgradeable.sol, ValidationRegistryUpgradeable.sol
- [S5] Onchain checks via JSON-RPC https://rpc.mainnet.arc.io: eth_getCode, EIP-1967 slot, getVersion(), owner(), eth_chainId (run 2026-10-02)
- [S6] https://github.com/erc-8004/best-practices Reputation.md (raw/best-practices-Reputation.md)
- [S7] https://docs.arc.io/arc/tutorials/register-your-first-ai-agent.md
- [S8] https://github.com/erc-8004/awesome-8004 (raw/awesome-8004.md)
- [S9] https://docs.arc.io/arc/tutorials/create-your-first-erc-8183-job.md
- [S10] ERC-8183 spec: https://raw.githubusercontent.com/ethereum/ERCs/master/ERCS/erc-8183.md
- [S11] Circle docs index, "How-to: Sign a message … EIP-712 typed data": https://developers.circle.com/llms.txt
- [S12] https://docs.arc.io/llms.txt (paymaster how-to) and Circle Gas Station (circle_llms.txt)
- [S13] https://developers.circle.com/agent-stack/agent-wallets.md
- [S14] https://developers.circle.com/agent-stack/agent-wallets/wallet-operations/custom-policies.md and supported-blockchains.md
- [S15] https://developers.circle.com/agent-stack.md (Facilitator Service: x402 on Arc, Base, Polygon)
- [S16] https://github.com/coinbase/x402 (moved to x402-foundation/x402)
