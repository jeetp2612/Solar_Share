# SolarShare ⚡

**Peer-to-peer solar energy trading for Indian rooftops — priced in ₹, settled on a real
SQL database and a real hash-chained ledger, with an optional live read from the
Polygon Amoy testnet (chainId 80002).**

Every account gets a wallet. Anyone can **Buy kWh** or **Sell kWh** — there are no
producer/consumer roles. Every money or energy movement mints a new block on the
on-database chain, which you can inspect and verify (tamper detection included) from
the dashboard.

Three ways to trade:

1. **Market sweep** — walk the cheapest asks (or highest bids) until you are filled,
   across as many neighbours as it takes, with a live route preview before you sign.
2. **Limit order** — set your own price (with an explicit margin versus the mid); the
   unfilled remainder rests on the book as your order.
3. **Direct P2P deal** — pick *one* named neighbour, take *part* of their lot (from
   their minimum slice up to the whole lot), negotiate inside a tolerance band, and
   optionally split delivery into instalments. Every instalment settles atomically and
   mints its own block, so "first some kWh, then the next some" is four verifiable
   records rather than one.

## Quick start

```bash
npm install
npm run dev        # http://localhost:8080
npm test           # app tests (incl. ledger tamper detection) + scaffold checks
```

📖 **First time running this project?** Follow the complete step-by-step guide:
**[`docs/LOCAL-SETUP.md`](docs/LOCAL-SETUP.md)** — VS Code, free Neon database
(5 minutes), running locally, the demo script (sign up → ₹500 → trade → chain),
pushing to GitHub, and deploying online (Vercel).

1. Sign up with an email + password (stored in SQL, hashed with better-auth).
2. Your profile + wallet are created on first load — you start with a **₹500 welcome credit**
   and a simulated 3 kWp rooftop that generates energy through the Mumbai daylight curve.
3. **Buy kWh** (market sweep, limit order, or a direct deal with one neighbour) or
   **Sell kWh** — both from the same wallet, including part of someone's lot.
4. Open the **chain** panel: see the latest blocks (hashes grouped so they are readable),
   run a full **integrity verification**, and check the **live network** panel for the
   Polygon Amoy head — pinned endpoint, latency, explorer link, and a plain-language
   reason when the environment has no egress.

## What is actually real (hackathon claims you can defend)

| Claim | Reality |
| --- | --- |
| **Indian currency** | All pricing, balances and ledger totals are INR (₹). Market base ₹8.5/kWh, live band ₹5.5–₹13.5, IST solar irradiance curve, Mumbai feeders (BKC–Andheri 14). |
| **Real user accounts** | better-auth email+password → SQL tables (`user`, `session`, `account`), bcrypt-scrypt hashing, httpOnly session cookies + bearer tokens. No fake logins. |
| **Real SQL** | PGLite (embedded PostgreSQL 16) with versioned migrations: `migrations/0001_auth.sql`, `migrations/0002_solarshare.sql`, `migrations/0003_payments.sql` (profiles, wallets, trades, orders, payment methods, `blocks`). Every balance change is a `UPDATE`, auditable in the DB. |
| **Real blockchain-style ledger** | A genuine hash chain in Postgres: block `n` carries the SHA-256 of its canonical payload (block no, prev hash, timestamp, transactions) and links to block `n-1`. Top-ups, buys, sells, order listings and withdrawals each mint a block. `verifyChain()` recomputes every hash from the raw DB rows and reports the exact first bad block (broken link or hash mismatch). Covered by 6 unit tests, including tamper detection. |
| **Real testnet read** | `src/lib/solar/testnet.server.ts` makes live JSON-RPC calls to public **Polygon Amoy** endpoints (`eth_chainId`, `eth_blockNumber`, `eth_getBlockByNumber`, `net_peerCount`, `eth_syncing`). The chainId is verified before a reading is accepted, the last healthy endpoint is sticky (so the URL stops rotating) and `SOLARSHARE_RPC_URL` pins one. Online → live head + explorer link; unreachable → last known head marked stale, with a classified plain-language reason (`no-egress`, `timeout`, `rate-limited`, `wrong-network`…). |
| **Partial lots & instalments** | `src/lib/deal.ts` is a pure, unit-tested engine: book sweep with per-leg fills, direct deals on part of a named neighbour's lot (`minSplitKwh` per seller), offer/counter inside a tolerance band, instalment splitting that always sums to the requested volume, and quotes with grid fee, slippage and margin versus the mid price. |
| **Wallet with two options + UPI rails** | Every user: **Buy kWh** and **Sell kWh**, plus UPI payment methods for top-up/withdraw in ₹. Payment records are stored in SQL and linked to the ledger block that moved the wallet balance. Surplus kWh accumulates from the simulated panel and can be sold into the market. |

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
      network-core.ts     pure bridge helpers: endpoints, sticky order, error
                          classification, monotonic head, hash grouping (+ tests)
      testnet.server.ts   live Polygon Amoy JSON-RPC client (read-only)
      types.ts            shared types
      use-solar.ts        client hooks (wallet, market, chain)
    deal.ts               trading engine: routing, partial lots, direct deals,
                          instalments, quotes (+ tests)
    market-data.ts        Mumbai solar pricing model (IST curve, feeder data)
    market-store.ts       client-side market/order book simulation
    auth/                 better-auth wiring (email + password, SQL adapter)
    db.ts                 PGLite singleton + migration runner
  components/dashboard/   wallet card + UPI setup, quick trade (market/limit/
                          direct), marketplace book, deal sheet, price chart,
                          trade feed, ledger dialog + live network panel
migrations/               versioned SQL (auth + SolarShare schema)
```

**Flow of a trade:** click Buy 5 kWh (or a 2 kWh slice of one neighbour's lot) →
`solarSettleTrade` server fn → SQL
`UPDATE wallets` + `INSERT trades` → `mintBlock()` computes the SHA-256 block and
inserts it into `blocks` + `trades` → UI refetches wallet, chain head and the
new block. Top-ups/withdrawals also insert a `payments` row with the UPI
reference. The same block is what `verifyChain()` later re-hashes from raw rows.

## Verification performed

- `npm test` — 82/82 app tests pass: ledger core (deterministic hashing, genesis
  invariants, tamper detection: changed tx → hash mismatch, missing block → broken
  link, altered prev hash → broken link), the trading engine (sweep order, limit
  prices, partial lots, minimum slices, offer/counter, instalment sums, budget →
  kWh, fee maths) and the network bridge (single-network endpoint list, sticky
  ordering, monotonic head, error classification, hash grouping).
- Full HTTP end-to-end (`node scripts/solar-e2e-smoke.mjs`, mirrors exactly what the
  browser sends to the server functions): sign-in → wallet auto-create (₹500) → top-up ₹250 (block minted) →
  buy 5 kWh @ ₹8.2 (₹41 debited, 5 kWh credited, block minted) → list 3 kWh ask
  (block minted) → `verifyChain` (ok, all blocks re-hashed) → recent blocks with
  tx details → withdraw ₹100 (block minted) → final wallet state consistent.
- SSR: dashboard renders fully server-side (₹ balances, market, wallet).

## Database — embedded now, one setting away from real Postgres

Out of the box the app runs on **PGLite** (real PostgreSQL 16 in WASM, in-memory
— data resets on server restart). To use a **proper persistent database**, set
`DATABASE_URL` — no code changes, same SQL, migrations apply automatically:

- **Complete first-run guide (VS Code → Neon → run → deploy):
  [`docs/LOCAL-SETUP.md`](docs/LOCAL-SETUP.md)**
- **Database details** (Neon vs local Postgres, browsing your data, FAQ):
  [`docs/PROPER-DATABASE.md`](docs/PROPER-DATABASE.md)
- Quick version: put `DATABASE_URL=postgres://…` in a **`.env.local`** file in
  the project root, then `npm run dev`. The dev server logs which backend it's
  on at startup.
- Everything (accounts, wallets, trades, the ledger) lives in that one
  database; the doc includes ready-to-run SQL to browse your data. UPI payment
  methods live in `payment_methods`; top-ups/withdrawals live in `payments` and
  reference their minted ledger block.

## Known limitations (be honest in your pitch)

- PGLite is in-memory per process: data resets on server restart (swap in real
  Postgres via the same SQL for durability).
- The ledger is a hash chain (Merkle-less PoA), not a consensus blockchain —
  the Amoy read is a genuine external chain, while the SolarShare chain is
  your application ledger *built like* a blockchain.
- Amoy access depends on egress; the app degrades gracefully when offline (last
  known head, labelled stale, with the reason).
- The order book's *neighbour* lots and their ambient activity are a client-side
  simulation; every settlement **you** make is real — SQL rows plus a minted,
  verifiable block.
