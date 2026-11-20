// Medians and quartiles per case from runs.jsonl: node tests/perf/recorded/kernel3d-lines-2026-11-19/digest.mjs
import { readFileSync } from 'node:fs';

const rows = readFileSync(new URL('./runs.jsonl', import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const groups = new Map();
for (const r of rows.filter((r) => r.kind === 'rep')) {
  const k = `${r.run} ${r.what} ${r.n} ${r.variant}`;
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r.ms);
}
const q = (s, f) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
console.log('run       what   segments  variant          median      p25      p75');
for (const [k, xs] of groups) {
  const s = [...xs].sort((a, b) => a - b);
  const [run, what, n, variant] = k.split(' ');
  const cell = (f) => q(s, f).toFixed(2).padStart(8);
  console.log(`${run.padEnd(9)} ${what.padEnd(6)} ${n.padStart(8)}  ${variant.padEnd(14)} ${cell(0.5)} ${cell(0.25)} ${cell(0.75)}`);
}
