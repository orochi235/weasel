import { readFileSync } from 'node:fs';
const [file, framesArg] = process.argv.slice(2);
const frames = Number(framesArg ?? 90);
const p = JSON.parse(readFileSync(file, 'utf8'));
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const parent = new Map();
for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
const dt = new Map();
for (let i = 0; i < p.samples.length; i++) dt.set(p.samples[i], (dt.get(p.samples[i]) ?? 0) + (p.timeDeltas[i + 1] ?? 0) / 1000);
const self = new Map(), total = new Map();
const key = (n) => `${n.callFrame.functionName || '(anon)'} ${(n.callFrame.url.split('/').pop() || '').split('?')[0]}:${n.callFrame.lineNumber + 1}`;
let renderTotal = 0, all = 0;
for (const [id, ms] of dt) {
  all += ms;
  const n = byId.get(id);
  self.set(key(n), (self.get(key(n)) ?? 0) + ms);
  const seen = new Set();
  let inRender = false;
  for (let cur = id; cur !== undefined; cur = parent.get(cur)) {
    const k = key(byId.get(cur));
    if (k.startsWith('render WeaselRenderer')) inRender = true;
    if (!seen.has(k)) { seen.add(k); total.set(k, (total.get(k) ?? 0) + ms); }
  }
  if (inRender) renderTotal += ms;
}
console.log(`sampled ${all.toFixed(1)} ms; inside WeaselRenderer.render ${renderTotal.toFixed(1)} ms = ${(renderTotal / frames).toFixed(2)} ms/frame`);
const rows = [...total.keys()].map((k) => [k, self.get(k) ?? 0, total.get(k)]).filter((r) => r[2] / frames > 0.05).sort((a, b) => b[2] - a[2]);
console.log('function'.padEnd(60), 'self ms/f', 'total ms/f');
for (const [k, s, t] of rows.slice(0, 45)) console.log(k.slice(0, 60).padEnd(60), (s / frames).toFixed(2).padStart(9), (t / frames).toFixed(2).padStart(10));
