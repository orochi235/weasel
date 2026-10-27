/**
 * Restarts a dev server the way a saved package file does (`restartLeavingNothing`, from
 * `vite-prebundle.ts`; `--bare` calls `server.restart(true)` alone) and records the heap after each restart, to find what a restart leaks.
 *
 *   node --expose-gc scripts/probe-dev-restarts.ts [--config apps/forge/vite.config.ts] [--restarts 8]
 *     [--bare] [--out <dir>, default node_modules/.probe-dev-restarts, cleared on each run] [--snapshots]
 *
 * Writes one JSON line per restart to `<out>/restarts.jsonl` as it finishes, and with `--snapshots`
 * a heap snapshot after the first and the last restart, which `--diff a b` summarizes by constructor.
 */
import { mkdirSync, appendFileSync, readFileSync, rmSync } from 'node:fs';
import { cpus, hostname, loadavg, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { writeHeapSnapshot } from 'node:v8';

const { values } = parseArgs({
  options: {
    config: { type: 'string', default: 'apps/forge/vite.config.ts' },
    restarts: { type: 'string', default: '8' },
    out: { type: 'string', default: 'node_modules/.probe-dev-restarts' },
    snapshots: { type: 'boolean', default: false },
    settle: { type: 'string', default: '4000' },
    diff: { type: 'string', multiple: true },
    bare: { type: 'boolean', default: false },
  },
});

/** Live object counts and self sizes by constructor, from a `.heapsnapshot` file. */
function byConstructor(file: string): Map<string, { count: number; size: number }> {
  const snap = JSON.parse(readFileSync(file, 'utf8'));
  const fields: string[] = snap.snapshot.meta.node_fields;
  const types: string[] = snap.snapshot.meta.node_types[0];
  const stride = fields.length;
  const [typeAt, nameAt, sizeAt] = ['type', 'name', 'self_size'].map((f) => fields.indexOf(f));
  const out = new Map<string, { count: number; size: number }>();
  const nodes: number[] = snap.nodes;
  for (let i = 0; i < nodes.length; i += stride) {
    const type = types[nodes[i + typeAt!]!];
    const name = type === 'object' || type === 'closure' ? `${type}:${snap.strings[nodes[i + nameAt!]!]}` : `(${type})`;
    const row = out.get(name) ?? { count: 0, size: 0 };
    row.count++;
    row.size += nodes[i + sizeAt!]!;
    out.set(name, row);
  }
  return out;
}

if (values.diff) {
  const [a, b] = values.diff.map((f) => byConstructor(f));
  const rows = [...b!].map(([name, r]) => ({ name, dCount: r.count - (a!.get(name)?.count ?? 0), dSize: r.size - (a!.get(name)?.size ?? 0) }));
  rows.sort((x, y) => y.dSize - x.dSize);
  for (const r of rows.slice(0, 60)) console.log(`${String(r.dSize).padStart(12)} ${String(r.dCount).padStart(9)}  ${r.name}`);
  process.exit(0);
}

const gc = (globalThis as { gc?: () => void }).gc;
if (!gc) throw new Error('run with node --expose-gc');
const out = resolve(values.out);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const restarts = Number(values.restarts);
const settle = Number(values.settle);

const { createServer } = await import('vite');
const { restartLeavingNothing } = await import('./vite-prebundle.ts');
const server = await createServer({ configFile: resolve(values.config), logLevel: 'warn', server: { port: 0, strictPort: false } });
await server.listen();
const base = server.resolvedUrls?.local[0] ?? `http://localhost:${server.config.server.port}/`;

const settleRound = async () => {
  await fetch(base).then((r) => r.text()).catch(() => '');
  await new Promise((r) => setTimeout(r, settle));
  gc();
  gc();
};
const record = (restart: number, ms: number) => {
  const m = process.memoryUsage();
  const row = {
    restart, ms: Math.round(ms), heapUsedMB: +(m.heapUsed / 2 ** 20).toFixed(1), rssMB: +(m.rss / 2 ** 20).toFixed(1),
    externalMB: +(m.external / 2 ** 20).toFixed(1), host: hostname(), cores: cpus().length, totalMemGB: +(totalmem() / 2 ** 30).toFixed(0),
    load1: +loadavg()[0]!.toFixed(2), config: values.config, at: new Date().toISOString(),
  };
  appendFileSync(join(out, 'restarts.jsonl'), JSON.stringify(row) + '\n');
  console.log(`onto: progress ${restart}/${restarts}`);
  console.log(`${String(restart).padStart(2)}/${restarts}  heap ${row.heapUsedMB.toFixed(1).padStart(7)} MB  rss ${row.rssMB.toFixed(1).padStart(7)} MB  ${String(row.ms).padStart(6)} ms`);
};

let t = performance.now();
await settleRound();
record(0, performance.now() - t);
for (let i = 1; i <= restarts; i++) {
  t = performance.now();
  await (values.bare ? server.restart(true) : restartLeavingNothing(server));
  await settleRound();
  record(i, performance.now() - t);
  if (values.snapshots && (i === 1 || i === restarts)) writeHeapSnapshot(join(out, `after-${i}.heapsnapshot`));
}
await server.close();
process.exit(0);
