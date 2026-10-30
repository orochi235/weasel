// Self time per function in a V8 .cpuprofile, largest first: node profile.mjs <file> [top=40]
import { readFileSync } from 'node:fs';
const p = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const top = Number(process.argv[3] ?? 40);
const dt = new Map();
for (let i = 0; i < p.samples.length; i++) dt.set(p.samples[i], (dt.get(p.samples[i]) ?? 0) + (p.timeDeltas[i] ?? 0));
const self = new Map();
let total = 0;
for (const n of p.nodes) {
  const t = dt.get(n.id) ?? 0;
  total += t;
  const f = n.callFrame;
  const key = `${f.functionName || '(anon)'} ${f.url.replace(/^.*\/packages\//, '')}:${f.lineNumber + 1}`;
  self.set(key, (self.get(key) ?? 0) + t);
}
for (const [k, t] of [...self].sort((a, b) => b[1] - a[1]).slice(0, top)) {
  console.log(`${(100 * t / total).toFixed(1).padStart(5)}%  ${(t / 1000).toFixed(0).padStart(7)} ms  ${k}`);
}
