// Draws the @weasel-js package dependency graph as two views:
//   base.svg  core and every package it depends on, directly or not
//   top.svg   everything else, with core standing in for the base layer
// Colors are each package's `weasel.tier` (scripts/lib/package-tiers.mjs). A package whose code reaches
// core only through @weasel-js/core/engine points at a node of that name instead of core. Edges are
// transitively reduced, and each view also writes a PNG at 2x.
//
//   node scripts/package-graph.mjs [outDir]   (default: <tmpdir>/weasel-package-graph, overwritten each run)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { importSpecifiers, isBare } from './lib/imports.mjs';
import { packageEntries } from './lib/packageEntries.mjs';
import { closureOf, readPackages, tierProblems } from './lib/package-tiers.mjs';
import { repoRoot } from './lib/workspaces.mjs';

const require = createRequire(join(repoRoot, 'package.json'));
const ELK = require('elkjs/lib/elk.bundled.js');
const { chromium } = require('playwright-core');

const COLORS = { base: '#4c78a8', core: '#222', plugin: '#e45756', other: '#b279a2', standalone: '#72b7b2' };
const PARTITION = { plugin: 0, other: 0, core: 1, base: 2, standalone: 2 };
const ENGINE = 'core/engine';

/** Every `@weasel-js/core` specifier the package's published entries load at run time, its own files followed. */
function coreSpecifiers(dir) {
  const queue = packageEntries(dir).map((e) => e.source).filter((s) => s && !s.includes('*') && /\.tsx?$/.test(s))
    .map((s) => join(dir, s));
  const seen = new Set(queue), found = new Set();
  while (queue.length) {
    const file = queue.shift();
    for (const spec of importSpecifiers(readFileSync(file, 'utf8'), file)) {
      if (isBare(spec)) { if (/^@weasel-js\/core(\/|$)/.test(spec)) found.add(spec); continue; }
      const base = resolve(dirname(file), spec.replace(/\.js$/, ''));
      const hit = ['.ts', '.tsx', '/index.ts', '/index.tsx', ''].map((x) => base + x).find((p) => existsSync(p) && !p.endsWith('/'));
      if (hit && /\.tsx?$/.test(hit) && !seen.has(hit)) { seen.add(hit); queue.push(hit); }
    }
  }
  return found;
}

function classify(packages) {
  const closure = closureOf(packages);
  const category = (n) => n === ENGINE ? 'core'
    : packages.get(n).tier === 'other' && !closure(n).has('core') ? 'standalone' : packages.get(n).tier;
  const edges = [];
  for (const [a, { deps, dir }] of packages) for (const c of deps) {
    if (deps.some((b) => b !== c && closure(b).has(c))) continue;
    const specs = c === 'core' ? [...coreSpecifiers(dir)] : [];
    const viaEngine = specs.length > 0 && specs.every((s) => s === '@weasel-js/core/engine');
    edges.push([a, viaEngine ? ENGINE : c]);
  }
  return { category, edges };
}

const textWidth = (s) => 14 + s.length * 7.4;

async function layout(nodes, edges, category) {
  const inView = new Set(nodes);
  return new ELK().layout({
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': 'DOWN', 'elk.partitioning.activate': 'true',
      'elk.layered.spacing.nodeNodeBetweenLayers': '46', 'elk.spacing.nodeNode': '14',
      'elk.edgeRouting': 'SPLINES', 'elk.layered.crossingMinimization.thoroughness': '40',
    },
    children: nodes.map((n) => ({ id: n, width: textWidth(n), height: 24,
      layoutOptions: { 'elk.partitioning.partition': String(PARTITION[category(n)]) } })),
    edges: edges.filter(([a, c]) => inView.has(a) && inView.has(c))
      .map(([a, c], i) => ({ id: `e${i}`, sources: [a], targets: [c] })),
  });
}

function toSvg(out, category) {
  const pad = 20, legendH = 34;
  const width = Math.ceil(out.width + pad * 2), height = Math.ceil(out.height + pad * 2 + legendH);
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" font-family="Menlo, monospace" font-size="12">`,
    '<defs><marker id="a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,2L8,4L0,6z" fill="#888"/></marker></defs>',
    `<rect width="100%" height="100%" fill="#fff"/><g transform="translate(${pad},${pad + legendH})">`];
  for (const e of out.edges) for (const s of e.sections ?? []) {
    const pts = [s.startPoint, ...(s.bendPoints ?? []), s.endPoint];
    const d = pts.length === 4
      ? `M${pts[0].x},${pts[0].y} C${pts.slice(1).map((p) => `${p.x},${p.y}`).join(' ')}`
      : `M${pts.map((p) => `${p.x},${p.y}`).join(' L')}`;
    parts.push(`<path d="${d}" fill="none" stroke="${COLORS[category(e.sources[0])]}" stroke-opacity="0.55" stroke-width="1.3" marker-end="url(#a)"/>`);
  }
  for (const n of out.children) {
    parts.push(`<rect x="${n.x}" y="${n.y}" width="${n.width}" height="${n.height}" rx="5" fill="${COLORS[category(n.id)]}"/>`,
      `<text x="${n.x + n.width / 2}" y="${n.y + 16}" text-anchor="middle" fill="#fff">${n.id}</text>`);
  }
  parts.push('</g>');
  let x = pad;
  for (const [k, c] of Object.entries(COLORS)) {
    parts.push(`<rect x="${x}" y="${pad - 6}" width="14" height="14" rx="3" fill="${c}"/><text x="${x + 20}" y="${pad + 5}">${k}</text>`);
    x += 34 + k.length * 7.4;
  }
  parts.push(`<text x="${x + 20}" y="${pad + 5}" fill="#666">arrows point at dependencies; transitively reduced</text></svg>`);
  return { svg: parts.join(''), width, height };
}

async function main() {
  const outDir = process.argv[2] ?? join(tmpdir(), 'weasel-package-graph');
  if (outDir.startsWith('-')) {
    console.error('usage: node scripts/package-graph.mjs [outDir]  (it takes no flags)');
    process.exit(2);
  }
  mkdirSync(outDir, { recursive: true });
  const packages = readPackages();
  const problems = tierProblems(packages);
  if (problems.length) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  const { category, edges } = classify(packages);
  const names = [...packages.keys()].sort();
  if (edges.some(([, c]) => c === ENGINE)) names.push(ENGINE);
  const views = {
    base: names.filter((n) => n !== ENGINE && ['base', 'core'].includes(category(n))),
    top: names.filter((n) => category(n) !== 'base'),
  };
  const browser = await chromium.launch({ headless: true });
  try {
    for (const [view, nodes] of Object.entries(views)) {
      const { svg, width, height } = toSvg(await layout(nodes, edges, category), category);
      writeFileSync(join(outDir, `${view}.svg`), svg);
      const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
      await page.setContent(`<body style="margin:0">${svg}</body>`);
      await page.screenshot({ path: join(outDir, `${view}.png`) });
      await page.close();
    }
  } finally {
    await browser.close();
  }
  for (const k of Object.keys(COLORS)) console.log(k.padEnd(14), names.filter((n) => category(n) === k).join(' '));
  console.log(`edges ${[...packages.values()].flatMap((p) => p.deps).length} → ${edges.length} after reduction`);
  console.log(`wrote ${outDir}/{base,top}.{svg,png}`);
}

await main();
