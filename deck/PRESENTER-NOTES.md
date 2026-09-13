# SolarShare — Data Forge pitch script (≈6 minutes + Q&A)

Slides: `SolarShare_DataForge.pptx` · PDF backup: `SolarShare_DataForge.pdf`
Team: **Jeet Patel**, **Shlok Vaghasiya**, **Dhruvit Vadukiya** — team name **Data Forge**.
The same text is in the PPTX *speaker notes* (View → Notes Page), so you can present with Presenter View.

**Before you go live**
1. `npm install && npm run dev` → `http://localhost:8080`, keep it open on a second tab.
2. Have a fresh browser at `/login` so sign-up looks instant.
3. If the room has no internet, the Amoy panel will show "unreachable" — that is the *correct*, designed behaviour; say so proudly.

---

## Slide 1 — Cover (0:00–0:35)
> Your roof is exporting power at a fixed government rate. Your neighbour is buying that same energy back at retail.
> Both of you lose, and nobody in between captures the value. We built that market.

We are **Data Forge** — Jeet, Shlok, Dhruvit. This is **SolarShare**: peer-to-peer rooftop solar for Indian
households, priced in ₹, settled on a real database, and stamped into a hash chain you can verify.
Everything on screen today is a running app, and I will tell you exactly which part is simulated.

## Slide 2 — Problem (0:35–1:30)
- **Locked surplus** — net metering pays a fixed feed-in tariff, monthly. No price, no buyer, no timing.
- **Neighbours never meet** — producer and buyer on the same feeder, 400 m apart, with no order book, no
  peer identity, no settlement rail, no record.
- **"Blockchain energy" that isn't** — most demos ship mockups. One question kills them: *where is the record?*
- Why now: residential rooftop is the fastest-growing segment; the ₹4–₹12/kWh band is the real value pool;
  every kWh traded peer-to-peer keeps that margin inside the feeder.

*Do not invent a market-size number. Say the tariff band and stop there.*

## Slide 3 — Product (1:30–2:45)
This is the live dashboard. One wallet, both directions — **Buy kWh** and **Sell kWh**, no producer/consumer roles.
Walk one row of the book: *"Sharma Rooftop, Andheri, 400 m, 3.9 of 8.4 kWh left, ₹5.65, reliability 4.9."*

**Live demo (do this, it is 60 seconds):**
sign up → ₹500 credit appears → pick a lot → sign the trade → point at the wallet: **₹ went down, kWh came up,
same transaction** → open **Ledger** → **Verify chain** → green banner.
If the demo cannot run, narrate the screenshot on the slide instead — it is from this same build.

## Slide 4 — Trading engine (2:45–3:45)
Three ways to trade, all in a pure TypeScript module (`src/lib/deal.ts`) — no React, no DB inside the maths:
- **Market sweep** (`routeFill`) — walks the cheapest asks across as many neighbours as needed; one order, many legs.
- **Limit order** — your price with an explicit margin vs the mid; remainder rests on the book.
- **Direct P2P deal** (`directDeal`, `splitInstalments`) — *one* named neighbour, *part* of their lot,
  an offer inside a ±2.5% band (accepted or countered), delivery split into instalments — each instalment its own block.

And nothing settles silently: average price, gross, grid fee, you pay, slippage, margin vs mid, blocks to mint —
all quoted **before** you sign.

## Slide 5 — Trust layer (3:45–5:00) ← your moat
- A block = SHA-256 over the canonical payload (block no, prev hash, timestamp, transactions), linked to n−1.
- Every top-up, buy, sell, listing and withdrawal mints one. A 3-instalment deal = 3 auditable records.
- `verifyChain()` re-hashes **from the raw Postgres rows** and names the first bad block.
- The UI feed is live without reloads: unchanged blocks keep object identity, new blocks land one at a time.
- Plus a **real external chain read**: Polygon Amoy JSON-RPC, chainId-guarded, graceful when offline.

Say the honesty line out loud: *"This is an application ledger built like a blockchain — hash-chained, verifiable,
tamper-evident. We are not claiming to run consensus ourselves."* Judges reward that far more than inflated claims.

## Slide 6 — Real, proof, next (5:00–6:00)
React 19 + TanStack Start (SSR) · better-auth email+password in SQL · PGLite now, `DATABASE_URL` for Neon ·
ledger split into pure core / SQL mint / live UI · Amoy bridge.
**105/105 tests**, plus one end-to-end HTTP smoke that mirrors exactly what the browser sends.
Honest limits: in-memory PGLite, simulated neighbour lots, PoA-shaped chain, egress-dependent Amoy reads.
Roadmap: **Persist → Share → Anchor → Comply.**

> Close: *"Give us real feeder data and one pilot housing society and we run this for real. Thank you — we are Data Forge."*

---

## Q&A crib sheet
| They ask | You say |
| --- | --- |
| Is this even legal? | We assume net-metering / open-access rules — that's why **Comply** is on the roadmap, not a footnote. The app already models grid fee and feeder identity. |
| Why not just use the existing net meter? | A meter prices nothing and matches nobody. We add a price, a counterparty and a record. |
| Someone edits the DB directly? | `verifyChain()` re-hashes from raw rows and reports the exact first broken block. It has tests for tamper detection. |
| Is this a real blockchain? | The SolarShare chain is a hash chain in Postgres — blockchain-style, not consensus. Amoy is a genuine external chain we read live, read-only. |
| Why did the network panel say unreachable? | No egress from this environment. The app labels the head *stale* with a reason instead of faking a number. |
| Where does real money move? | UPI payment methods stored in SQL, `payments` rows referenced by the ledger block that moved the wallet balance. Real payout is roadmap step 1. |
| Neighbours real? | The ambient lots in the book are a client-side simulation; **every settlement you make is real** — SQL rows plus a minted block. |
| Scale? | Postgres + an order-book write path; batching blocks and moving matching server-side are the next engineering steps. |

## Who answers what
- **Jeet Patel** — ledger, hashing, tamper detection, trading engine internals.
- **Shlok Vaghasiya** — marketplace UX, deal sheet, instalments, offer bands, route preview.
- **Dhruvit Vadukiya** — schema, auth, tests, the E2E smoke, the demo itself.
