// Captures real product screenshots for the Data Forge deck.
// Usage: LD_LIBRARY_PATH=/tmp/chr/extract/nss node scripts/shots-deck.mjs
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SHOT_BASE ?? "http://localhost:8080";
const OUT = process.env.SHOT_OUT ?? "deck/shots";
const EMAIL = "dataforge@solarshare.dev";
const PASS = "solar1234";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  executablePath: "/tmp/chr/extract/chromium",
  args: [
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--font-render-hinting=none",
    "--force-color-profile=srgb",
    "--disable-gpu",
    "--hide-scrollbars",
  ],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("PAGEERROR:", String(e).slice(0, 200)));

const shot = async (name, opts = {}) => {
  await page.waitForTimeout(opts.wait ?? 1000);
  await page.screenshot({
    path: `${OUT}/${name}.png`,
    ...(opts.clip ? { clip: opts.clip } : {}),
    ...(opts.full ? { fullPage: true } : {}),
  });
  console.log("shot:", name);
};

const clipOf = async (sel) => {
  const el = page.locator(sel).first();
  if (!(await el.count())) return null;
  const b = await el.boundingBox();
  if (!b) return null;
  return { x: Math.max(0, b.x - 14), y: Math.max(0, b.y - 14), width: Math.min(1600 - b.x, b.width + 28), height: b.height + 28 };
};

// ---- 1. login page ----
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await shot("01-login");

// ---- 2. create profile ----
await page.locator('#name').fill("Aarav Sharma");
await page.locator('#email').fill(EMAIL);
await page.locator('#password').fill(PASS);
await page.locator("form").getByRole("button", { name: "Create profile" }).click();
await page.waitForTimeout(5000);
console.log("after signup url:", page.url());

await page.goto(BASE, { waitUntil: "networkidle" });
await page.waitForTimeout(4500);
await shot("02-dashboard-full", { full: true });

// top region only (hero + overview cards)
await shot("03-dashboard-top", { wait: 300, clip: { x: 0, y: 0, width: 1600, height: 1000 } });

// marketplace book + quick trade
const book = await clipOf("text=Marketplace");
if (book) await shot("04-marketbook", { clip: book, wait: 200 });

const wallet = await clipOf("text=₹");
if (wallet) await shot("05-wallet", { clip: wallet, wait: 200 });

// ---- 3. direct P2P deal sheet ----
const rowBtn = page.getByRole("button", { name: "Buy", exact: true }).first();
if (await rowBtn.count()) {
  await rowBtn.click();
  await page.waitForTimeout(1800);
  await shot("06-deal-sheet", { clip: await clipOf('[role="dialog"]') ?? undefined });
  // nudge the instalment / offer controls if present
  const buyBtn = page.locator('[role="dialog"] button', { hasText: /Buy|Send offer|Confirm/ }).last();
  if (await buyBtn.count()) {
    try {
      await buyBtn.click({ timeout: 4000 });
      await page.waitForTimeout(2200);
      await shot("07-deal-confirmed", { clip: await clipOf('[role="dialog"]') ?? undefined });
    } catch (e) {
      console.log("deal confirm skipped:", String(e).slice(0, 80));
    }
  }
  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
}

// ---- 4. ledger dialog ----
const led = page.getByRole("button", { name: /Ledger/i }).first();
if (await led.count()) {
  await led.click();
  await page.waitForTimeout(2000);
  await shot("08-ledger", { clip: await clipOf('[role="dialog"]') ?? undefined });
  const verify = page.getByRole("button", { name: /Verify chain/i }).first();
  if (await verify.count()) {
    await verify.click();
    await page.waitForTimeout(3500);
    await shot("09-ledger-verified", { clip: await clipOf('[role="dialog"]') ?? undefined });
  }
  await page.keyboard.press("Escape");
}

// ---- 5. trade feed / blocks ----
await page.waitForTimeout(800);
const feed = await clipOf("text=Recent blocks, Text: feed");
await shot("10-dashboard-after", { clip: { x: 0, y: 0, width: 1600, height: 1000 } });

await browser.close();
console.log("DONE");
