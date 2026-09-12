// SolarShare E2E smoke script — runs the full wallet/trade/ledger flow over HTTP,
// sending exactly what the browser client sends (crossJSON server-fn payloads).
//
//   node scripts/solar-e2e-smoke.mjs            # against localhost:8080
//   E2E_HOST=8080-xxx.e2b.app node scripts/solar-e2e-smoke.mjs
//   E2E_EMAIL=you@you.in E2E_PASSWORD=... node scripts/solar-e2e-smoke.mjs
//
// Requires a running dev server (`npm run dev`) and an existing account.
// NOTE: intentionally NOT named *.test.mjs so `npm test` doesn't run it.

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { toJSON } = require("seroval");

const HOST = process.env.E2E_HOST ?? "localhost:8080";
const BASE = process.env.E2E_BASE ?? `http://${HOST}`;

function curl(args) {
  const out = execFileSync("curl", ["-s", "-w", "\n__STATUS__%{http_code}", ...args]).toString();
  const i = out.lastIndexOf("\n__STATUS__");
  return { status: Number(out.slice(i + 11)), body: out.slice(0, i) };
}

function apiPost(path, body) {
  const f = "/tmp/e2e-body.json";
  writeFileSync(f, JSON.stringify(body));
  return curl(["-X", "POST", `${BASE}${path}`, "-H", `Host: ${HOST}`, "-H", `Origin: http://${HOST}`, "-H", "Content-Type: application/json", "--data", `@${f}`]);
}

const signin = apiPost("/api/auth/sign-in/email", {
  email: process.env.E2E_EMAIL ?? "aarav@test.in",
  password: process.env.E2E_PASSWORD ?? "solar1234",
});
const token = JSON.parse(signin.body).token;
if (!token) { console.error("SIGNIN FAILED", signin); process.exit(1); }
console.log("1. sign-in OK, token", token.slice(0, 10) + "…");

const FNS = {
  getState: "eyJmaWxlIjoiL3NyYy9saWIvc29sYXIvYXBpLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InNvbGFyR2V0U3RhdGVfY3JlYXRlU2VydmVyRm5faGFuZGxlciJ9",
  topUp: "eyJmaWxlIjoiL3NyYy9saWIvc29sYXIvYXBpLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InNvbGFyVG9wVXBfY3JlYXRlU2VydmVyRm5faGFuZGxlciJ9",
  withdraw: "eyJmaWxlIjoiL3NyYy9saWIvc29sYXIvYXBpLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InNvbGFyV2l0aGRyYXdfY3JlYXRlU2VydmVyRm5faGFuZGxlciJ9",
  settle: "eyJmaWxlIjoiL3NyYy9saWIvc29sYXIvYXBpLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InNvbGFyU2V0dGxlVHJhZGVfY3JlYXRlU2VydmVyRm5faGFuZGxlciJ9",
  listOrder: "eyJmaWxlIjoiL3NyYy9saWIvc29sYXIvYXBpLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InNvbGFyTGlzdE9yZGVyX2NyZWF0ZVNlcnZlckZuX2hhbmRsZXIifQ",
  verify: "eyJmaWxlIjoiL3NyYy9saWIvc29sYXIvYXBpLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InNvbGFyVmVyaWZ5Q2hhaW5fY3JlYXRlU2VydmVyRm5faGFuZGxlciJ9",
  blocks: "eyJmaWxlIjoiL3NyYy9saWIvc29sYXIvYXBpLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InNvbGFyUmVjZW50QmxvY2tzX2NyZWF0ZVNlcnZlckZuX2hhbmRsZXIifQ",
  testnet: "eyJmaWxlIjoiL3NyYy9saWIvc29sYXIvYXBpLnRzP3Rzcy1zZXJ2ZXJmbi1zcGxpdCIsImV4cG9ydCI6InNvbGFyVGVzdG5ldF9jcmVhdGVTZXJ2ZXJGbl9oYW5kbGVyIn0",
};

function fnGet(id) {
  const payload = encodeURIComponent(JSON.stringify(toJSON({ context: { bearerToken: token } })));
  return curl([`${BASE}/_serverFn/${id}?payload=${payload}`, "-H", `Host: ${HOST}`, "-H", `Origin: http://${HOST}`, "-H", "x-tsr-serverFn: true", "-H", "accept: application/json"]);
}

function fnPost(id, data) {
  const f = "/tmp/e2e-body.json";
  writeFileSync(f, JSON.stringify(toJSON({ data, context: { bearerToken: token } })));
  return curl(["-X", "POST", `${BASE}/_serverFn/${id}`, "-H", `Host: ${HOST}`, "-H", `Origin: http://${HOST}`, "-H", "x-tsr-serverFn: true", "-H", "content-type: application/json", "-H", "accept: application/json", "--data", `@${f}`]);
}

function show(label, r) {
  let decoded;
  try { decoded = JSON.parse(r.body); } catch { decoded = r.body.slice(0, 300); }
  console.log(`\n${label} [${r.status}]`);
  console.log("  ", JSON.stringify(decoded).slice(0, 700));
}

show("2. solarGetState (auto-create wallet)", fnGet(FNS.getState));
show("3. solarTopUp ₹250 (mints block)", fnPost(FNS.topUp, { amount: 250 }));
show("4. solarSettleTrade buy 5 kWh @ ₹8.2 (mints block)", fnPost(FNS.settle, { action: "buy", legs: [{ peer: "Sharma Rooftop", peerAddress: "0x3A91bC82e4D14F7A12c8B0E1", kwh: 5, priceInr: 8.2 }] }));
show("5. solarListOrder ask 3 kWh @ ₹9 (mints block)", fnPost(FNS.listOrder, { side: "ask", kwh: 3, priceInr: 9 }));
show("6. solarVerifyChain", fnGet(FNS.verify));
show("7. solarRecentBlocks", fnGet(FNS.blocks));
show("8. solarTestnet (expect offline in sandbox)", fnGet(FNS.testnet));
show("9. solarWithdraw ₹100 (mints block)", fnPost(FNS.withdraw, { amount: 100 }));
show("10. final solarGetState", fnGet(FNS.getState));
