/* eslint-disable @typescript-eslint/no-explicit-any */
// Rasterises figma/frames/<id>.svg in Chromium with the design's web fonts, at 2x, into figma/renders/<id>.png.
// Run: node scripts/figma-rasterize.mts
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const sizes: Record<string, { w: number; h: number; file: string }> = JSON.parse(readFileSync("figma/frames/sizes.json", "utf8"));
const FONTS = `
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;700&family=Atkinson+Hyperlegible+Mono&family=Azeret+Mono&family=Material+Icons+Round&family=Material+Icons+Sharp&display=block">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/7.1.0/css/all.min.css">`;
const browser = await chromium.launch();
for (const [id, s] of Object.entries(sizes)) {
  const svg = readFileSync(s.file, "utf8");
  const page = await browser.newPage({ viewport: { width: s.w, height: s.h }, deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>html,body{margin:0;background:transparent}svg{display:block}</style></head><body>${svg}</body></html>`, { waitUntil: "load" });
  await page.evaluate(async () => { await (document as any).fonts.ready; });
  await page.waitForTimeout(500);
  const out = join("figma/renders", `${id.replace(":", "-")}.png`);
  await page.locator("svg").first().screenshot({ path: out });
  console.log(`${id} -> ${out}`);
  await page.close();
}
await browser.close();
console.log("renders:", readdirSync("figma/renders").join(", "));
