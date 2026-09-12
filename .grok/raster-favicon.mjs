import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const svg = readFileSync("/workspace/public/favicon.svg", "utf8");

const browser = await chromium.launch();
for (const size of [16, 32, 64]) {
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const tagged = svg.replace("<svg", `<svg width="${size}" height="${size}"`);
  await page.setContent(
    `<!doctype html><html><body style="margin:0;background:#07090C">${tagged}</body></html>`,
  );
  await page.screenshot({
    path: `/workspace/.grok/favicon-${size}.png`,
    omitBackground: false,
  });
  await page.close();
}
await browser.close();
console.log("rasterized 16/32/64");
