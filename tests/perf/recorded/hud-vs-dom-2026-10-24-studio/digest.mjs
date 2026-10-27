#!/usr/bin/env node
// Prints each cell of the hud-vs-dom result files named on the command line:
// renderer main thread and its script, and all threads plus the renderer's worker pool (the
// README's "All threads plus the pool"), median [min–max] of the samples, with
// the allocation profile's KB a frame where the run took one.
// usage: node digest.mjs <result.json>...
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const POOL = 'thread Renderer/ThreadPoolForegroundWorker';
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const cell = (xs) => `${median(xs).toFixed(2).padStart(6)} [${Math.min(...xs).toFixed(2).padStart(5)}–${Math.max(...xs).toFixed(2).padStart(5)}]`;

for (const file of process.argv.slice(2)) {
  const r = JSON.parse(readFileSync(file, 'utf8'));
  console.log(`${basename(file)}  ${r.git.sha.slice(0, 9)}${r.git.dirty ? ' dirty' : ''}  ${r.machine.cpu}  load ${r.machine.loadavg.join(' ')}`);
  console.log(`${'cell'.padEnd(30)} ${'main'.padStart(21)} ${'script'.padStart(21)} ${'all + pool'.padStart(21)} ${'KB/frame'.padStart(9)}`);
  for (const it of r.items) {
    const m = it.metrics;
    const main = m.main.samples;
    const pool = m[POOL]?.samples;
    const all = pool ? m.total.samples.map((t, i) => t + pool[i]) : null;
    const kb = m.allocated ? (m.allocated.value / 1024).toFixed(0).padStart(9) : ''.padStart(9);
    console.log(`${it.id.padEnd(30)} ${cell(main)} ${cell(m.script.samples)} ${all ? cell(all) : '—'.padStart(21)} ${kb}`);
  }
  console.log('');
}
