// Digest of trim-data-ply.runs.jsonl: per case and arm, the median over rounds of each round's
// median frame, for the head given (default: the latest in the file).
import { readFileSync } from 'node:fs';

const rows = readFileSync(new URL('./trim-data-ply.runs.jsonl', import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const head = process.argv[2] ?? rows.at(-1).head;
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const cases = new Map();
for (const r of rows.filter((x) => x.head === head)) {
  const key = `${r.n}\t${r.mode}`;
  const arm = (cases.get(key) ?? cases.set(key, {}).get(key))[r.arm] ??= { build: [], render: [], bytes: [] };
  arm.build.push(median(r.build));
  arm.render.push(median(r.render));
  arm.bytes.push(median(r.bytes.filter((b) => b !== null)));
}
console.log(`head ${head}`);
console.log('nodes  mode     arm         build ms   render ms   new-space KiB');
for (const [key, arms] of cases) {
  const [n, mode] = key.split('\t');
  for (const [arm, m] of Object.entries(arms)) {
    console.log(`${n.padStart(5)}  ${mode.padEnd(7)}  ${arm.padEnd(9)}  ${median(m.build).toFixed(3).padStart(9)}  ${median(m.render).toFixed(3).padStart(9)}  ${(median(m.bytes) / 1024).toFixed(1).padStart(12)}`);
  }
}
