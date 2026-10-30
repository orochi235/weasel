// Per label, the median across runs of each run's batch median: node digest.mjs <pass>/<node>/runs.jsonl
import { readFileSync } from 'node:fs';
const recs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
const by = new Map();
for (const r of recs) {
  const row = by.get(r.result.label) ?? { walk: [], rt: [], sp: [] };
  if (r.result.fullWalkMs) row.walk.push(r.result.fullWalkMs.median);
  if (r.result.roundTripNs) { row.rt.push(r.result.roundTripNs.median); row.sp.push(r.result.setPoseNs.median); }
  by.set(r.result.label, row);
}
console.log('label     runs  full walk ms  round trip ns  setPose ns');
for (const [label, r] of by) {
  console.log(`${label.padEnd(8)} ${String(r.walk.length).padStart(5)}  ${med(r.walk).toFixed(3).padStart(12)}  ${med(r.rt).toFixed(1).padStart(13)}  ${med(r.sp).toFixed(1).padStart(10)}`);
}
