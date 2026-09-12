# SolarShare ⚡

**Peer-to-peer solar energy trading for Indian rooftops — priced in ₹, settled on a real
SQL database and a real hash-chained ledger, with an optional live read from the
Polygon Sepolia testnet.**

Every account gets a wallet. Anyone can **Buy kWh** or **Sell kWh** — there are no
producer/consumer roles. Every money or energy movement mints a new block on the
on-database chain, which you can inspect and verify (tamper detection included) from
the dashboard.

## Quick start

```bash
npm install
npm run dev        # http://localhost:8080
npm test           # app tests (incl. ledger tamper detection) + scaffold checks
```

1. Sign up with an email + password (stored in SQL, hashed with better-auth).
2. Your profile + wallet are created on first load — you start with a **₹500 welcome credit**
   and a simulated 3 kWp rooftop that generates energy through the Mumbai daylight curve.
3. **Buy kWh** (quick trade or resting bid/ask order) or **Sell kWh** — both from the same wallet.
4. Open the **chain** panel: see the latest blocks, run a full **integrity verification**,
   and (when the sandbox has egress) see the live **Polygon Sepolia** head.

## What is actually real (hackathon claims you can defend)

| Claim | Reality |
| --- | --- |
| **Indian currency** | All pricing, balances and ledger totals are INR (₹). Market base ₹8.5/kWh, live band ₹5.5–₹13.5, IST solar irradiance curve, Mumbai feeders (BKC–Andheri 14). |
| **Real user accounts** | better-auth email+password → SQL tables (`user`, `session`, `account`), bcrypt-scrypt hashing, httpOnly session cookies + bearer tokens. No fake logins. |
| **Real SQL** | PGLite (embedded PostgreSQL 16) with versioned migrations: `migrations/0001_auth.sql`, `migrations/0002_solarshare.sql` (profiles, wallets, trades, orders, `blocks`, `chain_events`). Every balance change is a `UPDATE`, auditable in the DB. |
| **Real blockchain-style ledger** | A genuine hash chain in Postgres: block `n` carries the SHA-256 of its canonical payload (block no, prev hash, timestamp, transactions) and links to block `n-1`. Top-ups, buys, sells, order listings and withdrawals each mint a block. `verifyChain()` recomputes every hash from the raw DB rows and reports the exact first bad block (broken link or hash mismatch). Covered by 6 unit tests, including tamper detection. |
| **Real testnet read** | `src/lib/solar/testnet.server.ts` makes live JSON-RPC calls to public Polygon Sepolia endpoints (`eth_blockNumber`, `eth_getBlockByNumber`, `eth_syncing`). Online → shows the live head; offline → fails over cleanly with the reason (sandboxes without egress show "offline, last known state" by design). |
| **Wallet with two options** | Every user: **Buy kWh** and **Sell kWh**, plus top-up/withdraw in ₹. Surplus kWh accumulates from the simulated panel and can be sold into the market. |

## Architecture

```
src/
  routes/
    __root.tsx            auth provider + TanStack Query client (SSR-safe)
    login.tsx             sign up / sign in (better-auth via /api/auth/*)
    api/auth/$.ts         better-auth HTTP endpoint
    __index.tsx           dashboard (auth-gated)
  lib/
    solar/
      api.ts              server functions (createServerFn + auth middleware)
      ledger-core.ts      pure ledger: genesis, sha256 hashing, verifyBlocks  (+ tests)
      ledger.server.ts    SQL ledger: migrations-aware PGLite, mint/verify/inspect
      testnet.server.ts   live Polygon Sepolia JSON-RPC client (read-only)
      types.ts            shared types
      use-solar.ts        client hooks (wallet, market, chain)
    market-data.ts        Mumbai solar pricing model (IST curve, feeder data)
    market-store.ts       client-side market/order book simulation
    auth/                 better-auth wiring (email + password, SQL adapter)
    db.ts                 PGLite singleton + migration runner
  components/dashboard/   wallet card, quick trade, order book, price chart,
                          contract feed, ledger (chain explorer) dialog
migrations/               versioned SQL (auth + SolarShare schema)
```

**Flow of a trade:** click Buy 5 kWh → `solarSettleTrade` server fn → SQL
`UPDATE wallets` + `INSERT trades` → `mintBlock()` computes the SHA-256 block and
inserts it into `blocks` + `chain_events` → UI refetches wallet, chain head and
the new block. The same block is what `verifyChain()` later re-hashes from raw rows.

## Verification performed

- `npm test` — 61/61 app tests pass, including ledger core: deterministic hashing,
  genesis invariants, tamper detection (changed tx → hash mismatch, missing block →
  broken link, altered prev hash → broken link).
- Full HTTP end-to-end (mirrors exactly what the browser sends to the server
  functions): sign-in → wallet auto-create (₹500) → top-up ₹250 (block minted) →
  buy 5 kWh @ ₹8.2 (₹41 debited, 5 kWh credited, block minted) → list 3 kWh ask
  (block minted) → `verifyChain` (ok, all blocks re-hashed) → recent blocks with
  tx details → withdraw ₹100 (block minted) → final wallet state consistent.
- SSR: dashboard renders fully server-side (₹ balances, market, wallet).

## Database — embedded now, one setting away from real Postgres

Out of the box the app runs on **PGLite** (real PostgreSQL 16 in WASM, in-memory
— data resets on server restart). To use a **proper persistent database**, set
`DATABASE_URL` — no code changes, same SQL, migrations apply automatically:

- **Step-by-step guide: [`docs/PROPER-DATABASE.md`](docs/PROPER-DATABASE.md)**
  (free Neon cloud Postgres in ~5 minutes, or Postgres on your own machine)
- Quick version: put `DATABASE_URL=postgres://…` in a **`.env.local`** file in
  the project root, then `npm run dev`. The dev server logs which backend it's
  on at startup.
- Everything (accounts, wallets, trades, the ledger) lives in that one
  database; the doc includes ready-to-run SQL to browse your data.

## Known limitations (be honest in your pitch)

- PGLite is in-memory per process: data resets on server restart (swap in real
  Postgres via the same SQL for durability).
- The ledger is a hash chain (Merkle-less PoA), not a consensus blockchain —
  the Sepolia read is a genuine external chain, while the SolarShare chain is
  your application ledger *built like* a blockchain.
- Sepolia access depends on egress; the app degrades gracefully when offline.
