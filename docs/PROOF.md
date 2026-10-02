# Proof of work (run on this machine, Oct 2, 2026)

- Contracts: `forge test` -> 16 passed (unit, fuzz, invariant: contract balance always equals what it owes).
- Backend: `vitest` -> 43 passed (terms hashing, tx builders, tips, pictures, reputation, agent auth, caps, API end to end, ERC-8004, keys, admin, share card, keeper).
- `tsc --noEmit`, `eslint`, `next build`: clean. `npm audit`: 0 vulnerabilities.
- Live server smoke test: unsigned calls 401, forged session refused, cron locked, path traversal 404, rate limit returns 429 on the 21st call.
- NOT done: real Circle login, testnet/mainnet deploy, screens.
