# Proper (persistent) database — setup guide

SolarShare already talks to a **real database**. Today it runs on **PGLite** —
that is real PostgreSQL 16, compiled to WASM and running inside the app. The
downside: it lives in the server process's memory, so **restarting the dev
server wipes everything** (accounts, wallets, chain).

The same code can run on any **real Postgres** — your machine or a free cloud
one — with **one setting** and **zero code changes**. This document walks
through both options, step by step.

## How it works (read this once)

- `src/lib/db.ts` checks one environment variable: **`DATABASE_URL`**.
  - **`DATABASE_URL` is set** → the app connects to that Postgres server (`pg` driver).
  - **`DATABASE_URL` is NOT set** → the app falls back to embedded PGLite (memory).
- Both backends execute the **same SQL** from `migrations/`
  (`0001_auth.sql`, `0002_solarshare.sql`, `0003_payments.sql`), applied
  automatically at startup — tables are created for you, no manual `CREATE TABLE`.
- **Everything** is in that one database: auth (`user`, `session`, `account`),
  profiles, wallets, trades, orders, UPI methods, payment records, and the
  ledger (`blocks`).
- The dev wrapper (`scripts/with-app-env.mjs`) reads **`.env.local`** from the
  project root for you — that is where you put `DATABASE_URL` (Option C below).

---

## Option A — Free cloud Postgres on Neon (recommended, ~5 minutes)

Best for the hackathon: your database survives laptop restarts, browser
closes, dev-server restarts — and you can open the Neon SQL editor and show
judges the actual rows.

1. Go to **https://console.neon.tech** → sign in (GitHub login works) →
   **New project** → pick a name (e.g. `solarshare`) → any region.
2. On the project page, click **Connect** (top right).
3. You will see a **connection string** like:

   ```
   postgres://solar:SECRET_PASSWORD@ep-xxx-pooler.region.aws.neon.tech/solarshare?sslmode=require
   ```

4. In this project folder, create a file named **`.env.local`** (exactly this
   name, in the same folder as `package.json`):

   ```
   DATABASE_URL=postgres://solar:SECRET_PASSWORD@ep-xxx-pooler.region.aws.neon.tech/solarshare?sslmode=require
   ```

   ⚠️ Copy the **pooled** endpoint (`-pooler` in the host) — it handles
   connection limits for you. Never share or commit this file — it is already
   in `.gitignore`.

5. Stop the running dev server (Ctrl+C) and start it again:

   ```bash
   npm run dev
   ```

6. **Verify** it's using Neon — open the Neon console → **Dashboard → SQL
   editor**, and run:

   ```sql
   select count(*) as users from "user";
   select full_name, area from profiles;
   select block_no, block_hash from blocks order by block_no desc limit 5;
   ```

   After you sign up in the app and make one trade, you will see **your rows**
   there. That is the proof: real Postgres, real SQL, real ledger.

> Restart the app any time — your accounts, wallet and chain are still there.

## Option B — Postgres on your own machine

1. **Install Postgres**
   - macOS: `brew install postgresql@16` then `brew services start postgresql@16`
   - Ubuntu/Debian: `sudo apt install postgresql` (starts automatically)
2. **Create the database** (on macOS, first run `brew link --force postgresql@16`
   if the `createdb` command is not found):

   ```bash
   createdb solarshare
   ```

   On Ubuntu the command may need to run as the postgres user:
   `sudo -u postgres createdb solarshare`.

3. Put this in **`.env.local`** (replace `your_user` with your OS username):

   ```
   DATABASE_URL=postgres://your_user@localhost:5432/solarshare
   ```

4. `npm run dev` (after stopping the old one). Done.

Check from a terminal:

```bash
psql solarshare -c "select count(*) from blocks;"
```

## Option C — (reference) without the `.env.local` file

You can also export the variable in your terminal instead of using a file:

```bash
export DATABASE_URL="postgres://your_user@localhost:5432/solarshare"
npm run dev
```

(Exported variables always win over the file, if both are set.)

---

## Day-to-day commands

| You want to… | Do this |
| --- | --- |
| Use the real DB | Keep `DATABASE_URL` in `.env.local`, then `npm run dev` |
| Temporarily go back to memory (fresh demo data) | Delete/comment the `DATABASE_URL` line, `npm run dev` |
| Start completely fresh on the real DB | Neon: console → your database → **Reset** (or `drop schema public cascade;` then restart the app — migrations re-apply). Local: `dropdb solarshare && createdb solarshare`, restart the app. |
| See what's stored | Neon: SQL editor. Local: `psql solarshare`. Handy queries below. |

## Handy queries (the "look at my data" menu)

```sql
-- My accounts
select "id", email, "name" from "user";

-- Wallets (INR balance + kWh credits)
select full_name, inr, kwh_credits, surplus_kwh from wallets w
  join profiles p using (user_id);

-- My open orders (bid = want to buy, ask = want to sell)
select side, kwh, price_inr from orders where status = 'open';

-- My saved UPI methods
select label, upi_id, is_default, last_used_at
from payment_methods
where status = 'active';

-- Wallet funding history (UPI top-ups / withdrawals linked to blocks)
select direction, amount_inr, provider_ref, upi_id, block_no, created_at
from payments
order by created_at desc;

-- The chain, newest first
select block_no, tx_count, total_kwh, total_inr, timestamp,
       left(block_hash, 20) || '…' as hash
from blocks order by block_no desc;

-- Every transaction inside the chain
select b.block_no, t.kind, t.buyer_name, t.seller_name, t.kwh, t.price_inr
from trades t join blocks b using (block_no)
order by b.block_no desc, t.created_at;
```

## FAQ

**Why did my data disappear?** The app was running without `DATABASE_URL`
(memory mode). Check the file exists in the project root, is named exactly
`.env.local`, and that you restarted the dev server after creating it.

**How do I know which mode I'm in?** The dev server logs the backend at
startup (it prints the database source), or just try: make a top-up, restart
the app — if the chain is still there, you're on the real DB.

**Can the deployed version use this too?** Yes — on Vercel (or any host) put
the same `DATABASE_URL` as a project environment variable; the code path is
identical.

**Is my password safe?** The password lives in `.env.local`, which
`.gitignore` protects, and it is only ever sent to your own Postgres over
localhost/SSL. Never paste it into chat or commit it.
