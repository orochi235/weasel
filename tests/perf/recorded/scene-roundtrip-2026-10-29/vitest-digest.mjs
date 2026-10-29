// Prints the median, across runs, of each scene-ops row's median, before and after, from vitest-ab.sh's
// JSON files: node tests/perf/recorded/scene-roundtrip-2026-10-29/vitest-digest.mjs <pass>/<node>
import { readFileSync, readdirSync } from 'node:fs';

const dir = process.argv[2];
const rows = new Map();
for (const f of readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
  const side = f.split('-')[0];
  const report = JSON.parse(readFileSync(`${dir}/${f}`, 'utf8'));
  for (const file of report.testResults) {
    for (const t of file.assertionResults) {
      if (!/scene\.(add|setPose)|per-frame/.test(t.fullName)) continue;
      for (const b of t.benchmarks ?? []) {
        for (const task of b.tasks) {
          const k = `${t.fullName} | ${task.name}`;
          if (!rows.has(k)) rows.set(k, { before: [], after: [] });
          rows.get(k)[side].push(task.latency.p50 * 1e6);
        }
      }
    }
  }
}
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1]; };
console.log(`${'row'.padEnd(78)} ${'before'.padStart(7)} ${'after'.padStart(7)}  ns, median of runs`);
for (const [k, v] of rows) console.log(`${k.padEnd(78)} ${med(v.before).toFixed(0).padStart(7)} ${med(v.after).toFixed(0).padStart(7)}`);
