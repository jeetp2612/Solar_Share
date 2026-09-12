# Running SolarShare on YOUR machine (VS Code) — complete guide

Follow the steps in order. Each step says exactly what to type or click.
Total time: ~10 minutes the first time.

```
Step 0  Install tools (once, on your machine)
Step 1  Get the code into VS Code
Step 2  Install project dependencies
Step 3  Create your free database (Neon)        ← 5 minutes
Step 4  Connect the database to the project
Step 5  Run the project
Step 6  Try the app (wallet, ₹500 credit, trades, chain)
Step 7  Push your code to GitHub
Step 8  Deploy it online (Vercel)
```

---

## Step 0 — Install tools (one time only)

1. **VS Code** — install from https://code.visualstudio.com (if not already there).
2. **Node.js 22 or newer** — check in VS Code's terminal (Terminal → New Terminal):

   ```bash
   node -v
   ```

   - If it prints `v22.…` or higher → you're good.
   - If it errors or prints `v18`/`v20` → install Node 22 LTS from
     https://nodejs.org (pick the **LTS** button), then restart VS Code.

## Step 1 — Get the code into VS Code

In VS Code: **File → Open Folder…** and open the SolarShare folder
(clone it first from GitHub if you don't have it: `git clone <your-repo-url>`).

Everything below runs in VS Code's terminal for that folder.

## Step 2 — Install project dependencies

```bash
npm install
```

> **Always run `npm install` on a new machine**, even though `node_modules`
> is in the repo. It takes a minute and fixes the platform-specific binary
> files (they differ between Windows/Mac/Linux — skipping this is the #1
> reason the dev server fails to start).

## Step 3 — Create your free database (Neon)

We use **Neon** — real cloud PostgreSQL, free for a hackathon, no install on
your machine, and the same database later works for your deployed site.

1. Open **https://console.neon.tech** and sign in (GitHub login works).
2. Click **New project** → name it `solarshare` → any region → **Create**.
3. Wait ~30 seconds, then click the **Connect** button (top right).
4. Copy the **connection string**. It looks like:

   ```
   postgres://solar:SECRET@ep-xxxx-pooler.ap-south-1.aws.neon.tech/solarshare?sslmode=require
   ```

   ✅ Make sure it is the **pooled** one — its host contains **`-pooler`**.

That string is your database. Neon already created an empty Postgres for you.

## Step 4 — Connect the database to the project

1. In VS Code, in the **Explorer** (file list, same place as `package.json`),
   right-click → **New File** → name it exactly:

   ```
   .env.local
   ```

2. Open it and paste ONE line (your string from Step 3):

   ```
   DATABASE_URL=postgres://solar:SECRET@ep-xxxx-pooler.ap-south-1.aws.neon.tech/solarshare?sslmode=require
   ```

   (A ready template with comments exists as `.env.local.example` — you can
   also just run `cp .env.local.example .env.local` in the terminal and paste
   your string into the result.)

3. **Do not commit this file** — it is in `.gitignore` and contains your
   password.

## Step 5 — Run the project

```bash
npm run dev
```

Watch the terminal. **This line tells you the database mode:**

```
[db] using Postgres from DATABASE_URL (persistent)      ← ✅ what you want
[db] using embedded PGLite (in-memory — data resets…)   ← ❌ .env.local not picked up
```

Open **http://localhost:8080** in your browser. You'll see the dashboard.

## Step 6 — Try the app (do it in this order, it's your demo script)

1. **Sign up** (top-right → Sign in → the *Sign up* tab)
   - Enter **your name**, any email, any password (6+ chars) → **Create profile**.
2. You land back on the dashboard with:
   - a big banner: **"Good morning/afternoon/evening, YOUR NAME ⚡"**
   - a chip: **"🎁 Welcome credit added — ₹500 is in your wallet"** (shows once)
   - your name in the top-right corner.
3. **Wallet card** (right side): shows your **₹500 balance**, 0 kWh, your
   3 kWp rooftop. Click **Top up** → pick **₹250** (quick button) → **Add**.
   Balance becomes **₹750** and a new **block** is minted.
4. **Buy energy**: in the *Trade* panel choose **Buy**, type **5** kWh →
   confirm. Balance drops by the INR cost, you receive **5 kWh credits**,
   another block is minted.
5. **Sell energy**: your simulated roof generates kWh during daylight —
   the *Surplus to sell* number grows; switch the trade panel to **Sell**
   and sell some surplus for ₹.
6. **Ledger** (button in the header): see **every block** with its hash,
   the transactions inside each block, and run **Verify chain** →
   "Chain intact — N blocks re-hashed".
7. **Proof it's real**: open the Neon console → **SQL editor**, run:

   ```sql
   select full_name, inr, kwh_credits from wallets;
   select block_no, tx_count, left(block_hash, 16) || '…' from blocks order by block_no desc;
   ```

   Your wallet and your blocks are there, in a real PostgreSQL server.
   **Restart the app** (`Ctrl+C`, then `npm run dev`) — everything is still there.

## Step 7 — Push your code to GitHub

```bash
git add -A
git commit -m "my SolarShare changes"
git push
```

(If this is your first push of the repo: create an empty repo on
github.com first, then follow the "Push an existing repository" steps GitHub
shows on that page.)

## Step 8 — Deploy it online (Vercel)

The project is built for **Vercel** (its build config is already set up).

1. Push to GitHub (Step 7).
2. Go to **https://vercel.com** → sign in with GitHub → **Add New → Project**
   → import your SolarShare repo → **Deploy**.
3. Before deploying, in **Settings → Environment Variables**, add **two**:

   | Name                 | Value                                        |
   | -------------------- | -------------------------------------------- |
   | `DATABASE_URL`       | your Neon string (same as `.env.local`)      |
   | `VITE_AUTH_ENABLED`  | `true`                                       |

   Set them for **Production, Preview and Development**.

4. **Deploy**. The build automatically runs your database migrations
   (tables are created for you — no manual SQL).
5. You get a URL like `https://solarshare-xxxx.vercel.app`. Open it, sign up,
   top up, trade — and run the SQL from Step 6 in Neon to watch your rows
   appear. **Your local app and the deployed app share the same database.**

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Cannot find native binding` on `npm run dev` | `npm install` again (platform binaries out of date). |
| `[db] using embedded PGLite…` in the terminal | `.env.local` not found: wrong name, or not in the project root (next to `package.json`), or no line break issues — must be exactly `DATABASE_URL=…`. Then restart `npm run dev`. |
| `getaddrinfo ENOTFOUND` / `ECONNREFUSED` to Neon | Typos in the string; check it's the **`-pooler`** host; copy it again from the Neon **Connect** panel. |
| Port 8080 already in use | Another dev server is running — stop it (Ctrl+C in its terminal) or close other copies. |
| Site works but sign-in fails on the deployed URL | `VITE_AUTH_ENABLED` missing in Vercel environment variables (must be exactly `true`). |
| Forgot your Neon password | Neon console → your database → **Settings → Credentials** → reset. Update `.env.local` + Vercel env var. |
| Want to start with a FRESH database | Neon console → your database → **Reset** (pick "truncate" or "wipe"), restart the app — migrations re-apply automatically. |
