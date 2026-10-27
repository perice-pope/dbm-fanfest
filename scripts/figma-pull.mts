/* eslint-disable @typescript-eslint/no-explicit-any */
// Pulls the Figma file as data: full node tree, PNG renders of every top-level frame,
// every image asset used in the file, and a per-frame inventory of text, type, colours and layout.
// Run: node scripts/figma-pull.mts [fileKey]
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const KEY = process.argv[2] ?? "GYEU1tG1pavHWKE9tjZ3PC";
const OUT = "figma";
const token = (process.env.FIGMA_TOKEN ?? readFileSync(join(homedir(), ".config/figma/token"), "utf8")).trim();
if (!token) throw new Error("No Figma token. Save it to ~/.config/figma/token");
const H = { "X-Figma-Token": token };

async function api(path: string) {
  const r = await fetch(`https://api.figma.com/v1${path}`, { headers: H });
  if (!r.ok) throw new Error(`${path} -> ${r.status} ${await r.text()}`);
  return r.json();
}
async function download(url: string, to: string) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`download ${url} -> ${r.status}`);
  writeFileSync(to, Buffer.from(await r.arrayBuffer()));
}
const safe = (s: string) => s.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase().slice(0, 60);
const hex = (c: { r: number; g: number; b: number; a?: number }) => "#" + [c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");

for (const d of ["", "renders", "assets", "site", "compare"]) mkdirSync(join(OUT, d), { recursive: true });

console.log("fetching file…");
const file = await api(`/files/${KEY}`);
writeFileSync(join(OUT, "file.json"), JSON.stringify(file));
console.log(`name=${file.name} editorType=${file.editorType} lastModified=${file.lastModified}`);

type Node = Record<string, any>;
const frames: { id: string; name: string; page: string; w: number; h: number; node: Node }[] = [];
for (const page of file.document.children ?? []) {
  for (const c of page.children ?? []) {
    const list = c.type === "SECTION" ? (c.children ?? []) : [c];
    for (const f of list) {
      if (!["FRAME", "COMPONENT", "COMPONENT_SET", "INSTANCE", "GROUP"].includes(f.type)) continue;
      const bb = f.absoluteBoundingBox ?? { width: 0, height: 0 };
      frames.push({ id: f.id, name: f.name, page: page.name, w: Math.round(bb.width), h: Math.round(bb.height), node: f });
    }
  }
}
console.log(`${frames.length} top-level frames`);

// Renders at 2x.
for (let i = 0; i < frames.length; i += 25) {
  const batch = frames.slice(i, i + 25);
  const res = await api(`/images/${KEY}?ids=${batch.map((f) => encodeURIComponent(f.id)).join(",")}&format=png&scale=2`);
  for (const f of batch) {
    const url = res.images?.[f.id];
    if (!url) { console.log(`no render for ${f.name}`); continue; }
    await download(url, join(OUT, "renders", `${safe(f.name)}--${f.id.replace(":", "-")}.png`));
  }
}
console.log("renders done");

// Image assets (fills) with their original pixels.
const imgs = await api(`/files/${KEY}/images`);
const refs: Record<string, string> = imgs.meta?.images ?? {};
const assetFiles: Record<string, string> = {};
for (const [ref, url] of Object.entries(refs)) {
  const to = join(OUT, "assets", `${ref}.png`);
  if (!existsSync(to)) await download(url, to);
  assetFiles[ref] = to;
}
console.log(`${Object.keys(refs).length} image assets`);

// Inventory.
const fonts = new Map<string, number>();
const colors = new Map<string, number>();
const inventory: any[] = [];
function walk(n: Node, frame: Node, depth: number, out: any[]) {
  const fb = frame.absoluteBoundingBox ?? { x: 0, y: 0 };
  const bb = n.absoluteBoundingBox;
  const rel = bb ? { x: Math.round(bb.x - fb.x), y: Math.round(bb.y - fb.y), w: Math.round(bb.width), h: Math.round(bb.height) } : null;
  const fills = (n.fills ?? []).filter((f: Node) => f.visible !== false);
  const solid = fills.filter((f: Node) => f.type === "SOLID").map((f: Node) => hex(f.color) + (f.opacity != null && f.opacity < 1 ? ` @${Math.round(f.opacity * 100)}%` : ""));
  const images = fills.filter((f: Node) => f.type === "IMAGE").map((f: Node) => ({ ref: f.imageRef, scaleMode: f.scaleMode, file: assetFiles[f.imageRef] ?? null }));
  const gradients = fills.filter((f: Node) => String(f.type).startsWith("GRADIENT")).map((f: Node) => ({ type: f.type, stops: (f.gradientStops ?? []).map((s: Node) => ({ at: +s.position.toFixed(2), color: hex(s.color), a: +(s.color.a ?? 1).toFixed(2) })) }));
  const rec: any = { depth, id: n.id, type: n.type, name: n.name, rel, visible: n.visible !== false };
  if (solid.length) rec.fill = solid;
  if (images.length) rec.image = images;
  if (gradients.length) rec.gradient = gradients;
  if (n.strokes?.length) rec.stroke = { colors: n.strokes.filter((s: Node) => s.type === "SOLID").map((s: Node) => hex(s.color)), weight: n.strokeWeight };
  if (n.cornerRadius) rec.radius = n.cornerRadius;
  if (n.rectangleCornerRadii) rec.radii = n.rectangleCornerRadii;
  if (n.opacity != null && n.opacity < 1) rec.opacity = n.opacity;
  if (n.effects?.length) rec.effects = n.effects.filter((e: Node) => e.visible !== false).map((e: Node) => ({ type: e.type, radius: e.radius, offset: e.offset, color: e.color ? hex(e.color) + ` a${+(e.color.a ?? 1).toFixed(2)}` : undefined }));
  if (n.layoutMode) rec.layout = { mode: n.layoutMode, gap: n.itemSpacing, pad: [n.paddingTop, n.paddingRight, n.paddingBottom, n.paddingLeft], align: n.primaryAxisAlignItems, cross: n.counterAxisAlignItems, wrap: n.layoutWrap, sizing: [n.primaryAxisSizingMode, n.counterAxisSizingMode] };
  if (n.type === "TEXT") {
    const s = n.style ?? {};
    rec.text = n.characters;
    rec.font = { family: s.fontFamily, ps: s.fontPostScriptName, weight: s.fontWeight, size: s.fontSize, lineHeight: s.lineHeightPx, letterSpacing: s.letterSpacing, case: s.textCase, align: s.textAlignHorizontal };
    fonts.set(`${s.fontFamily} ${s.fontWeight} ${s.fontSize}px`, (fonts.get(`${s.fontFamily} ${s.fontWeight} ${s.fontSize}px`) ?? 0) + 1);
  }
  for (const c of solid) colors.set(c, (colors.get(c) ?? 0) + 1);
  out.push(rec);
  for (const c of n.children ?? []) walk(c, frame, depth + 1, out);
}
for (const f of frames) {
  const nodes: any[] = [];
  walk(f.node, f.node, 0, nodes);
  inventory.push({ id: f.id, name: f.name, page: f.page, w: f.w, h: f.h, nodes });
}
writeFileSync(join(OUT, "inventory.json"), JSON.stringify({ file: file.name, lastModified: file.lastModified, frames: inventory, fonts: [...fonts.entries()], colors: [...colors.entries()].sort((a, b) => b[1] - a[1]) }, null, 1));

// Human summary.
let md = `# ${file.name} (${file.lastModified})\n\n## Frames\n\n| Frame | Page | Size | Text layers | Images |\n|---|---|---|---|---|\n`;
for (const f of inventory) md += `| ${f.name} | ${f.page} | ${f.w}×${f.h} | ${f.nodes.filter((n: any) => n.text != null).length} | ${f.nodes.filter((n: any) => n.image).length} |\n`;
md += `\n## Fonts (family weight size: count)\n\n` + [...fonts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `- ${k}: ${v}`).join("\n");
md += `\n\n## Colours (most used first)\n\n` + [...colors.entries()].sort((a, b) => b[1] - a[1]).slice(0, 40).map(([k, v]) => `- ${k}: ${v}`).join("\n");
for (const f of inventory) {
  md += `\n\n## ${f.name} (${f.w}×${f.h})\n\n| y | x | layer | text | font |\n|---|---|---|---|---|\n`;
  for (const n of f.nodes.filter((n: any) => n.text != null && n.visible)) md += `| ${n.rel?.y} | ${n.rel?.x} | ${"  ".repeat(Math.max(0, n.depth - 1))}${n.name} | ${String(n.text).replace(/\|/g, "\\|").replace(/\n/g, " ⏎ ").slice(0, 80)} | ${n.font.family} ${n.font.weight} ${n.font.size}/${Math.round(n.font.lineHeight ?? 0)} ${n.fill?.[0] ?? ""} |\n`;
}
writeFileSync(join(OUT, "inventory.md"), md);
console.log(`inventory: ${inventory.length} frames, ${fonts.size} type styles, ${colors.size} colours -> figma/inventory.md`);
