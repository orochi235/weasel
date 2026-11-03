// Draws the @weasel-js package dependency graph as two views:
//   base.svg  core and every package it depends on, directly or not
//   top.svg   everything else, with core standing in for the base layer
// Edges are transitively reduced, and each view also writes a PNG at 2x.
//
//   node scripts/package-graph.mjs [outDir]   (default: <tmpdir>/weasel-package-graph, overwritten each run)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishableWorkspaces, repoRoot } from './lib/workspaces.mjs';

const require = createRequire(join(repoRoot, 'package.json'));
const ELK = require('elkjs/lib/elk.bundled.js');
const { chromium } = require('playwright-core');

// Drop-in canvas features. Everything else falls out of the graph itself.
const PLUGINS = new Set(['d3', 'devtools', 'diagram', 'diagram-elk', 'guides', 'hud', 'minimap',
  'parallax', 'path-tools', 'plot', 'rig', 'symmetry']);
const COLORS = { base: '#4c78a8', core: '#222', plugin: '#e45756', 'other-on-core': '#b279a2', standalone: '#72b7b2' };
const PARTITION = { plugin: 0, 'other-on-core': 0, core: 1, base: 2, standalone: 2 };
const SCOPE = '@weasel-js/';

function readGraph() {
  const deps = {};
  for (const { manifest } of publishableWorkspaces()) {
    if (!manifest.name.startsWith(SCOPE)) continue;
    deps[manifest.name.slice(SCOPE.length)] = Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
      .filter((k) => k.startsWith(SCOPE)).map((k) => k.slice(SCOPE.length));
  }
  return deps;
}

function classify(deps) {
  const memo = new Map();
  const closure = (n) => {
    if (memo.has(n)) return memo.get(n);
    const seen = new Set(), stack = [...(deps[n] ?? [])];
    while (stack.length) { const x = stack.pop(); if (!seen.has(x)) { seen.add(x); stack.push(...(deps[x] ?? [])); } }
    memo.set(n, seen);
    return seen;
  };
  const base = closure('core');
  const category = (n) => n === 'core' ? 'core' : base.has(n) ? 'base' : PLUGINS.has(n) ? 'plugin'
    : closure(n).has('core') ? 'other-on-core' : 'standalone';
  const edges = [];
  for (const [a, ds] of Object.entries(deps)) for (const c of ds) {
    if (!ds.some((b) => b !== c && closure(b).has(c))) edges.push([a, c]);
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
  mkdirSync(outDir, { recursive: true });
  const deps = readGraph();
  const { category, edges } = classify(deps);
  const names = Object.keys(deps).sort();
  const views = {
    base: names.filter((n) => ['base', 'core'].includes(category(n))),
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
  console.log(`edges ${Object.values(deps).flat().length} → ${edges.length} after reduction`);
  console.log(`wrote ${outDir}/{base,top}.{svg,png}`);
}

await main();
