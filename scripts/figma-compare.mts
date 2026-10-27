// Side-by-side: Figma render vs our page at the same width, plus a pixel diff and an HTML viewer with an overlay slider.
// Needs figma/compare-map.json: [{ "frame": "<frame name or id>", "url": "/destroyedbymoths", "width": 390, "fullPage": true, "mobile": true }]
// Run: E2E_BASE_URL=http://localhost:3000 node scripts/figma-compare.mts
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { chromium, devices } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const OUT = "figma";
const map: { frame: string; url: string; width: number; fullPage?: boolean; mobile?: boolean; signInAs?: string }[] = JSON.parse(readFileSync(join(OUT, "compare-map.json"), "utf8"));
const renders = readdirSync(join(OUT, "renders"));

/** Renders are figma/renders/<node id with ':' as '-'>.png at scale 2; the frame's CSS size is half the PNG size. */
function findRender(frame: string) {
  const idFile = `${frame.replace(":", "-")}.png`;
  const file = renders.find((r) => r === idFile || r.endsWith(`--${idFile}`));
  if (!file) throw new Error(`render missing for ${frame}`);
  const png = PNG.sync.read(readFileSync(join(OUT, "renders", file)));
  return { f: { id: frame, name: frame, w: png.width / 2, h: png.height / 2, file }, png };
}
function scaleTo(src: PNG, width: number) {
  const ratio = width / src.width;
  const h = Math.round(src.height * ratio);
  const out = new PNG({ width, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < width; x++) {
    const sx = Math.min(src.width - 1, Math.floor(x / ratio)), sy = Math.min(src.height - 1, Math.floor(y / ratio));
    const si = (sy * src.width + sx) * 4, di = (y * width + x) * 4;
    out.data[di] = src.data[si]; out.data[di + 1] = src.data[si + 1]; out.data[di + 2] = src.data[si + 2]; out.data[di + 3] = src.data[si + 3];
  }
  return out;
}
function canvas(w: number, h: number) { const p = new PNG({ width: w, height: h }); p.data.fill(0); for (let i = 3; i < p.data.length; i += 4) p.data[i] = 255; return p; }
function blit(dst: PNG, src: PNG, dx: number, dy: number) { for (let y = 0; y < src.height && y + dy < dst.height; y++) for (let x = 0; x < src.width && x + dx < dst.width; x++) { const si = (y * src.width + x) * 4, di = ((y + dy) * dst.width + (x + dx)) * 4; dst.data.set(src.data.subarray(si, si + 4), di); } }

const browser = await chromium.launch();
const rows: string[] = [];
for (const m of map) {
  const { f, png } = findRender(m.frame);
  const ctx = await browser.newContext({ ...(m.mobile ? { ...devices["iPhone 13"], isMobile: true, hasTouch: true } : {}), viewport: { width: m.width, height: Math.max(600, Math.round(f.h * (m.width / f.w))) }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${m.url}`, { waitUntil: "networkidle" });
  await page.addStyleTag({ content: "*{animation:none!important;transition:none!important} nextjs-portal{display:none!important}" });
  const sitePath = join(OUT, "site", `${f.id.replace(":", "-")}.png`);
  await page.screenshot({ path: sitePath, fullPage: m.fullPage !== false });
  await ctx.close();
  const site = PNG.sync.read(readFileSync(sitePath));
  const W = m.width * 2;
  const fig = scaleTo(png, W), web = scaleTo(site, W);
  const H = Math.max(fig.height, web.height);
  const sbs = canvas(W * 2 + 24, H); blit(sbs, fig, 0, 0); blit(sbs, web, W + 24, 0);
  const sbsPath = join(OUT, "compare", `${f.id.replace(":", "-")}-side-by-side.png`);
  writeFileSync(sbsPath, PNG.sync.write(sbs));
  const dh = Math.min(fig.height, web.height);
  const a = canvas(W, dh), b = canvas(W, dh); blit(a, fig, 0, 0); blit(b, web, 0, 0);
  const diff = new PNG({ width: W, height: dh });
  const changed = pixelmatch(a.data, b.data, diff.data, W, dh, { threshold: 0.12, includeAA: true });
  const diffPath = join(OUT, "compare", `${f.id.replace(":", "-")}-diff.png`);
  writeFileSync(diffPath, PNG.sync.write(diff));
  const pct = (100 * changed / (W * dh)).toFixed(1);
  console.log(`${f.name}: figma ${fig.width}x${fig.height} vs site ${web.width}x${web.height} -> ${pct}% pixels differ`);
  rows.push(`<section><h2>${f.name} <small>${pct}% differ · figma ${Math.round(fig.height / 2)}px tall vs site ${Math.round(web.height / 2)}px</small></h2>
<div class="pair"><figure><figcaption>Figma</figcaption><img src="../renders/${f.file}"></figure><figure><figcaption>Site</figcaption><img src="../site/${f.id.replace(":", "-")}.png"></figure><figure><figcaption>Diff</figcaption><img src="${f.id.replace(":", "-")}-diff.png"></figure></div>
<div class="overlay"><figcaption>Overlay (drag the slider)</figcaption><div class="stack"><img src="../renders/${f.file}"><img class="top" src="site/${f.id.replace(":", "-")}.png"></div><input type="range" min="0" max="100" value="50" oninput="this.previousElementSibling.querySelector('.top').style.opacity=this.value/100"></div></section>`);
}
await browser.close();
writeFileSync(join(OUT, "compare", "index.html"), `<!doctype html><meta charset="utf-8"><title>Figma vs site</title><style>body{font:14px system-ui;background:#111;color:#eee;margin:16px}h2 small{color:#999;font-weight:400;margin-left:8px}.pair{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}figure{margin:0}figcaption{color:#aaa;margin:4px 0}img{width:100%;height:auto;display:block;background:#000}.overlay{margin:16px 0 40px;max-width:420px}.stack{position:relative}.stack .top{position:absolute;inset:0;opacity:.5}input{width:100%}</style><h1>Figma vs site</h1>${rows.join("\n")}`);
console.log(`viewer: figma/compare/index.html`);
