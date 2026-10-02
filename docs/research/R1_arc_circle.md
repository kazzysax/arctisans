# R1: Arc mainnet + Circle wallets

Oct 2, 2026. Written from the official docs saved in `raw/`; nothing was deployed or created.

## 1. Arc mainnet
- **Chain ID:** 5042.
- **RPC:** `https://rpc.mainnet.arc.io`. Checked live: `eth_chainId` returns 0x13b2.
- **Explorer:** `https://explorer.arc.io`. Source: raw/arc_connect.md.
- **USDC:**
  - It is the native gas token, with 18 decimals.
  - It is also available as an optional ERC-20 at `0x3600000000000000000000000000000000000000`, with 6 decimals.
  - Both are one shared balance. Source: raw/arc_arc_references_contract-addresses.md.
- **Gotchas:** source raw/arc_evm_differences.md.
  - `PREVRANDAO` is always 0.
  - Mempool floor of 20 gwei `maxFeePerGas`. Transactions below it are dropped silently.
  - A blocklist revert still costs gas.
  - Sends to `address(0)` revert.
  - Every USDC movement also produces a system Transfer log (EIP-7708) at 18 decimals.
  - Osaka EVM baseline.
- **Finality:** deterministic, under a second. One confirmation is enough.
- **Tooling:** Foundry works. Use Arc Foundry (`arc-forge`, `arc-anvil`) for fork tests. viem ships an `arc` chain definition (see R4).
- **ERC-8004 agent registries** are already deployed on mainnet (see R2).

## 2. Sign-in: Circle user-controlled wallets (email OTP + Google)
- **Methods:** social login (Google, Apple, Facebook), email OTP, or PIN. Source: raw/../authentication-methods.md.
- **Arc support:** Arc mainnet (`ARC`) supports user-controlled **EOA and SCA**. Source: raw/developers.circle.com_wallets_supported-blockchains.md.
- **Email OTP:** we must configure our **own SMTP**; Circle does not send the email. Recovery depends on the user's access to their email account.
- **Google:** needs our Google OAuth client ID, entered in the Circle Console.
- **Flow:**
  1. The server SDK `@circle-fin/user-controlled-wallets` (Node ≥22) creates the user and token.
  2. The client Web SDK `@circle-fin/w3s-pw-web-sdk` runs the login and returns userToken, encryptionKey and refreshToken. The token lasts 14 days and can be refreshed.
  3. Every transaction is a **challenge** that the user confirms in Circle's built-in confirmation UI. We can't skip this step.
- **Batching:** SCA wallets expose `executeBatch`. Approve + fund is **one confirmation and one transaction**, through `POST /user/transactions/contractExecution`. Source: raw/developers.circle.com_wallets_batch-operations.md.

## 3. Gas Station (gas sponsorship)
- **Coverage:** supports **Arc mainnet** and testnet. Source: raw/developers.circle.com_wallets_gas-station.md.
- **Policy:** a mainnet sponsorship policy must be created in the Console (toggle to mainnet, then Gas Station, then Policy).
- **Billing:** the developer's **credit card** is charged. Invoices are due within 7 days. Sponsorship stops if the policy is paused or a payment fails.
- **Cost:** Arc gas is about 1 cent per transaction.

## 4. Agent wallets
- **Developer-controlled wallets:** EOA or SCA on Arc. We hold the keys through an entity secret registered once. Contract calls go through `POST /developer/transactions/contractExecution`.
- **Circle Agent Stack wallets:** offer built-in per-transaction, daily, weekly and monthly limits on Arc mainnet. Limit changes are confirmed by an email code. Details in R2.
- **v1 choice:**
  - Agents managed by an owner use **developer-controlled wallets**, with caps enforced in our backend and an exact-amount USDC approval.
  - Agents bringing their own wallet sign with their own key, either Agent Stack or EOA.

## 5. Pricing and mainnet access
- **Pricing:** Wallets cost per Monthly Active Wallet. **The first 1,000 each month are free.** Above that, about $0.038–0.05 per wallet. Source: raw/circle_wallets.txt.
- **⚠ Unverified, and the biggest blocker risk:** whether a standard Circle Developer Console account can use **mainnet** user-controlled wallets straight away.
  - The docs show separate mainnet API keys, and Gas Station needs a credit card.
  - Some products (CPN, Mint, on/off-ramps) need an approval or onboarding step. I couldn't confirm either way for Wallets.
  - **Action:** the owner opens console.circle.com, switches to Mainnet, and checks whether an API key can be created and a Gas Station policy can be set up. Do this first thing.
- **Compliance:** OFAC screening is built in. Wallets that transact with sanctioned addresses get restricted.

## 6. App Kit Send vs our contract for tips
- App Kit Send is a plain token transfer. Tips go through our `ArctisanSocial.tip()` instead, as an approve + tip batch. That keeps the tip tied to the post hash in our own events, which reputation needs. App Kit isn't needed in v1.

## Owner setup, in order
1. **Circle Developer Console:** account, switch to Mainnet, create an API key, then confirm mainnet works (§5).
2. **Circle Console, user-controlled wallets:**
   - set up the App ID
   - enable email OTP using the Resend SMTP details
   - enable Google by entering the Google OAuth client ID
3. **Gas Station:** a mainnet policy for Arc, with a credit card on file.
4. **Entity secret:** register it for the developer-controlled agent wallets.
