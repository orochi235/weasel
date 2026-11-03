// Per round, each label's round trip and setPose medians less the first label's, then the median of those:
//   node pairs.mjs <pass>/<node>/runs.jsonl
import { readFileSync } from 'node:fs';
const recs = readFileSync(process.argv[2], 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const labels = [...new Set(recs.map((r) => r.result.label))];
const rounds = new Map();
for (const r of recs) {
  const row = rounds.get(r.round) ?? new Map();
  row.set(r.result.label, r.result);
  rounds.set(r.round, row);
}
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
const f = (n) => n.toFixed(1).padStart(7);
for (const label of labels.slice(1)) {
  const rt = [];
  const sp = [];
  for (const row of rounds.values()) {
    const a = row.get(labels[0]);
    const b = row.get(label);
    if (!a || !b) continue;
    rt.push(b.roundTripNs.median - a.roundTripNs.median);
    sp.push(b.setPoseNs.median - a.setPoseNs.median);
  }
  console.log(`${label} - ${labels[0]}, ns per round`);
  console.log(`  round trip ${rt.map(f).join('')}   median ${f(med(rt))}`);
  console.log(`  setPose    ${sp.map(f).join('')}   median ${f(med(sp))}`);
}
