// Prints each label's median, across runs, of the per-run round-trip and setPose medians, in
// the order the labels first appear: node tests/perf/recorded/scene-roundtrip-2026-10-29/digest.mjs <runs.jsonl>
import { readFileSync } from 'node:fs';

const runs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const by = new Map();
for (const r of runs) {
  const k = `${r.result.label} ${r.sha}`;
  if (!by.has(k)) by.set(k, []);
  by.get(k).push(r.result);
}
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
const f = (x) => x.toFixed(0).padStart(6);
console.log(`${'label sha'.padEnd(28)} ${'rt med'.padStart(6)} ${'rt lo'.padStart(6)} ${'rt hi'.padStart(6)} ${'sp med'.padStart(6)}  runs`);
for (const [k, rs] of by) {
  const rt = rs.map((r) => r.roundTripNs.median);
  console.log(`${k.padEnd(28)} ${f(med(rt))} ${f(Math.min(...rt))} ${f(Math.max(...rt))} ${f(med(rs.map((r) => r.setPoseNs.median)))}  ${String(rs.length).padStart(4)}`);
}
