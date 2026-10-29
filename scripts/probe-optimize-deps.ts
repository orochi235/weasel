/**
 * Runs vite's dep optimizer for a dev config again and again in one process, with no server, and records memory
 * after each run: whether a forced re-bundle, on its own, keeps native memory.
 *
 *   node --expose-gc scripts/probe-optimize-deps.ts [--config apps/forge/vite.config.ts] [--runs 8] [--fresh-config]
 *     [--out <dir>, default node_modules/.probe-optimize-deps, cleared on each run]
 *
 * Writes one JSON line per run to `<out>/runs.jsonl` as it finishes. `--fresh-config` resolves the config before every
 * run instead of once, as a server restart does.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, rmSync } from 'node:fs';
import { cpus, hostname, loadavg } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    config: { type: 'string', default: 'apps/forge/vite.config.ts' },
    runs: { type: 'string', default: '8' },
    out: { type: 'string', default: 'node_modules/.probe-optimize-deps' },
    'fresh-config': { type: 'boolean', default: false },
  },
});
const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error('run with node --expose-gc');
const out = resolve(values.out);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const runs = Number(values.runs);

const mb = (n: number) => +(n / 2 ** 20).toFixed(1);
const footprint = () => {
  if (process.platform !== 'darwin') return undefined;
  try {
    const text = execFileSync('vmmap', ['--summary', String(process.pid)], { encoding: 'utf8', maxBuffer: 2 ** 26 });
    const m = /^Physical footprint:\s+([\d.]+)([KMG])/m.exec(text);
    const mimalloc = /^IOAccelerator\s+\S+\s+\S+\s+(\S+)/m.exec(text)?.[1];
    return { footprint: m ? `${m[1]}${m[2]}` : undefined, mimallocDirty: mimalloc };
  } catch { return undefined; }
};

const { optimizeDeps, resolveConfig } = await import('vite');
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
    run, ms: Math.round(performance.now() - t), heapUsedMB: mb(m.heapUsed), rssMB: mb(m.rss), ...footprint(),
    freshConfig: values['fresh-config'], config: values.config, host: hostname(), cores: cpus().length,
    load1: +loadavg()[0]!.toFixed(2), node: process.version, at: new Date().toISOString(),
  };
  appendFileSync(join(out, 'runs.jsonl'), JSON.stringify(row) + '\n');
  console.log(`onto: progress ${run}/${runs}`);
  console.log(`${String(run).padStart(2)}/${runs}  heap ${row.heapUsedMB.toFixed(1).padStart(7)} MB  rss ${row.rssMB.toFixed(1).padStart(7)} MB  footprint ${String(row.footprint).padStart(6)}  mimalloc ${String(row.mimallocDirty).padStart(6)}  ${String(row.ms).padStart(6)} ms`);
}
process.exit(0);
