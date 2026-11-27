/**
 * Runs vite's dep optimizer for a dev config again and again in one process, with no server, and records memory
 * after each run: whether a forced re-bundle, on its own, keeps native memory.
 *
 *   node --expose-gc scripts/probe-optimize-deps.ts [--config apps/forge/vite.config.ts] [--runs 8] [--fresh-config]
 *     [--out <dir>, default node_modules/.probe-optimize-deps, cleared on each run]
 *
 * Writes one JSON line per run to `<out>/runs.jsonl` as it finishes, with mimalloc's dirty memory on macOS
 * (`lib/vmmap-regions.mjs`). `--fresh-config` resolves the config before every run instead of once, as a server
 * restart does.
 */
import { appendFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { cpus, hostname, loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { cli } from './lib/help.mjs';
import { nativeRegions, retagMimalloc } from './lib/vmmap-regions.mjs';

const { values: parsed } = cli(import.meta.url, {
  summary: "Runs vite's dep optimizer for a dev config again and again in one process, with no server, and records memory after each run: whether a forced re-bundle, on its own, keeps native memory. Run with node --expose-gc.",
  options: {
    config: { type: 'string', placeholder: '<vite config>', default: 'apps/forge/vite.config.ts', description: 'the config to optimize for' },
    runs: { type: 'string', placeholder: '<n>', default: '8', description: 'optimizer runs' },
    out: { type: 'string', placeholder: '<dir>', default: 'node_modules/.probe-optimize-deps', description: 'cleared, then one JSON line per run goes to <out>/runs.jsonl' },
    'fresh-config': { type: 'boolean', default: false, description: 'resolve the config before every run, as a server restart does' },
  },
});
const values = parsed as { config: string; runs: string; out: string; 'fresh-config': boolean };

retagMimalloc();
const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error('run with node --expose-gc');
const out = resolve(values.out);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const runs = Number(values.runs);

const mb = (n: number) => +(n / 2 ** 20).toFixed(1);
const { optimizeDeps, resolveConfig } = await import('vite');
const fromVite = createRequire(import.meta.resolve('vite'));
const rolldownVersion: string = JSON.parse(readFileSync(fromVite.resolve('rolldown/package.json'), 'utf8')).version;
const configure = () => resolveConfig({ configFile: resolve(values.config), logLevel: 'error' }, 'serve');
let config = await configure();
for (let run = 0; run <= runs; run++) {
  const t = performance.now();
  if (run > 0) {
    if (values['fresh-config']) config = await configure();
    await optimizeDeps(config, true);
  }
  await new Promise((r) => setTimeout(r, 1000));
  gc();
  gc();
  const m = process.memoryUsage();
  const row = {
    run, ms: Math.round(performance.now() - t), heapUsedMB: mb(m.heapUsed), rssMB: mb(m.rss), externalMB: mb(m.external),
    arrayBuffersMB: mb(m.arrayBuffers), ...nativeRegions(),
    freshConfig: values['fresh-config'], config: values.config, host: hostname(), cores: cpus().length,
    load1: +loadavg()[0]!.toFixed(2), node: process.version, rolldown: rolldownVersion,
    mimallocEnv: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('MIMALLOC_'))),
    at: new Date().toISOString(),
  };
  appendFileSync(join(out, 'runs.jsonl'), JSON.stringify(row) + '\n');
  console.log(`onto: progress ${run}/${runs}`);
  console.log(`${String(run).padStart(2)}/${runs}  heap ${row.heapUsedMB.toFixed(1).padStart(7)} MB  rss ${row.rssMB.toFixed(1).padStart(7)} MB  footprint ${String(row.footprintMB ?? '-').padStart(7)}  mimalloc ${String(row.mimallocDirtyMB ?? '-').padStart(7)}  ${String(row.ms).padStart(6)} ms`);
}
process.exit(0);
