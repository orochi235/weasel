/**
 * Restarts a dev server the way a saved package file does (`restartLeavingNothing`, from
 * `vite-prebundle.ts`; `--bare` calls `server.restart` alone) and records the heap after each restart, to find what a restart leaks.
 * Each record also carries the thread, worker and descriptor counts, the active handles, and on macOS `vmmap --summary`'s
 * resident and dirty size per region and the bytes allocated per malloc zone. vmmap names mimalloc's memory, which is
 * rolldown's and oxc's, `IOAccelerator`: both use VM tag 100. After the first and the last restart the full `vmmap`, a
 * `sample` of every thread's stack and `lsof` go beside the records, and `workers.txt` logs the stack that started each
 * worker thread and whether it exited.
 *
 *   node --expose-gc scripts/probe-dev-restarts.ts [--config apps/forge/vite.config.ts] [--restarts 8]
 *     [--bare] [--keep-deps] [--out <dir>, default node_modules/.probe-dev-restarts, cleared on each run] [--snapshots]
 *
 * `--keep-deps` restarts without forcing the dep optimizer to re-bundle, which a package edit does force.
 * Writes one JSON line per restart to `<out>/restarts.jsonl` as it finishes, and with `--snapshots`
 * a heap snapshot after the first and the last restart, which `--diff a b` summarizes by constructor.
 * Measured runs are kept in `probe-dev-restarts.runs.jsonl`.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, appendFileSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, hostname, loadavg, totalmem } from 'node:os';
import { createRequire, syncBuiltinESMExports } from 'node:module';
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
    'keep-deps': { type: 'boolean', default: false },
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

// Each worker thread is a whole isolate, outside this one's heap: log who starts one and whether it ends.
const liveWorkers = new Set<number>();
{
  const require = createRequire(import.meta.url);
  const threads = require('node:worker_threads') as typeof import('node:worker_threads');
  const Base = threads.Worker;
  threads.Worker = class extends Base {
    constructor(script: string | URL, options?: import('node:worker_threads').WorkerOptions) {
      super(script, options);
      const id = this.threadId;
      liveWorkers.add(id);
      appendFileSync(join(out, 'workers.txt'), `start ${id} ${String(script).slice(0, 200)}\n${new Error().stack}\n\n`);
      this.once('exit', () => { liveWorkers.delete(id); appendFileSync(join(out, 'workers.txt'), `exit ${id}\n\n`); });
    }
  };
  syncBuiltinESMExports();
}

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
const mb = (n: number) => +(n / 2 ** 20).toFixed(1);
/** `vmmap`'s sizes (`5456K`, `1.2G`, a bare byte count) in MB. */
const vmSize = (s: string) => {
  const m = /^([\d.]+)([KMG]?)$/.exec(s);
  return m ? mb(Number(m[1]) * { '': 1, K: 2 ** 10, M: 2 ** 20, G: 2 ** 30 }[m[2] as '' | 'K' | 'M' | 'G']) : NaN;
};
/** Resident and dirty MB by region type, allocated and dirty MB by malloc zone, and the physical footprint. */
function vmmap(restart: number) {
  if (process.platform !== 'darwin') return {};
  let text: string;
  try { text = execFileSync('vmmap', ['--summary', String(process.pid)], { encoding: 'utf8', maxBuffer: 2 ** 26 }); } catch { return {}; }
  writeFileSync(join(out, `vmmap-${restart}.txt`), text);
  if (restart === 0 || restart === restarts) {
    try { writeFileSync(join(out, `vmmap-full-${restart}.txt`), execFileSync('vmmap', ['--wide', String(process.pid)], { encoding: 'utf8', maxBuffer: 2 ** 28 })); } catch {}
    try { execFileSync('sample', [String(process.pid), '1', '-mayDie', '-file', join(out, `sample-${restart}.txt`)], { stdio: 'ignore' }); } catch {}
    try { writeFileSync(join(out, `lsof-${restart}.txt`), execFileSync('lsof', ['-p', String(process.pid)], { encoding: 'utf8', maxBuffer: 2 ** 26 })); } catch {}
  }
  const regions: Record<string, { resident: number; dirty: number }> = {};
  const zones: Record<string, { allocated: number; dirty: number }> = {};
  let table: 'none' | 'regions' | 'zones' = 'none';
  for (const line of text.split('\n')) {
    if (line.startsWith('REGION TYPE')) table = 'regions';
    else if (line.startsWith('MALLOC ZONE')) table = 'zones';
    if (line.startsWith('===') || line.startsWith('REGION TYPE') || line.startsWith('MALLOC ZONE') || line.startsWith('TOTAL')) continue;
    const cols = line.slice(0, 32).trim() ? [line.slice(0, 32).trim(), ...line.slice(32).trim().split(/\s+/)] : [];
    if (table === 'regions' && cols.length >= 4) regions[cols[0]!] = { resident: vmSize(cols[2]!), dirty: vmSize(cols[3]!) };
    if (table === 'zones' && cols.length >= 7) zones[cols[0]!.replace(/_0x[0-9a-f]+$/, '')] = { allocated: vmSize(cols[6]!), dirty: vmSize(cols[3]!) };
  }
  const footprint = /^Physical footprint:\s+(\S+)/m.exec(text)?.[1];
  return { footprintMB: footprint ? vmSize(footprint) : undefined, regions, zones };
}
const threads = () => {
  try {
    return process.platform === 'darwin'
      ? execFileSync('ps', ['-M', '-p', String(process.pid)], { encoding: 'utf8' }).trim().split('\n').length - 1
      : readdirSync(`/proc/${process.pid}/task`).length;
  } catch { return undefined; }
};
const handles = () => {
  const counts: Record<string, number> = {};
  for (const kind of process.getActiveResourcesInfo()) counts[kind] = (counts[kind] ?? 0) + 1;
  return counts;
};
const record = (restart: number, ms: number) => {
  const m = process.memoryUsage();
  const row = {
    restart, ms: Math.round(ms), heapUsedMB: mb(m.heapUsed), heapTotalMB: mb(m.heapTotal), rssMB: mb(m.rss),
    externalMB: mb(m.external), arrayBuffersMB: mb(m.arrayBuffers), threads: threads(), workers: liveWorkers.size,
    fds: readdirSync('/dev/fd').length, handles: handles(), ...vmmap(restart), host: hostname(), cores: cpus().length, totalMemGB: +(totalmem() / 2 ** 30).toFixed(0),
    load1: +loadavg()[0]!.toFixed(2), config: values.config, bare: values.bare, keepDeps: values['keep-deps'],
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(WEASEL_|MIMALLOC_)/.test(k))),
    at: new Date().toISOString(),
  };
  appendFileSync(join(out, 'restarts.jsonl'), JSON.stringify(row) + '\n');
  console.log(`onto: progress ${restart}/${restarts}`);
  const footprint = row.footprintMB === undefined ? '' : `  footprint ${row.footprintMB.toFixed(1).padStart(7)} MB`;
  console.log(`${String(restart).padStart(2)}/${restarts}  heap ${row.heapUsedMB.toFixed(1).padStart(7)} MB  rss ${row.rssMB.toFixed(1).padStart(7)} MB${footprint}  threads ${String(row.threads).padStart(4)}  fds ${String(row.fds).padStart(5)}  ${String(row.ms).padStart(6)} ms`);
};

let t = performance.now();
await settleRound();
record(0, performance.now() - t);
for (let i = 1; i <= restarts; i++) {
  t = performance.now();
  await (values.bare ? server.restart(!values['keep-deps']) : restartLeavingNothing(server, !values['keep-deps']));
  await settleRound();
  record(i, performance.now() - t);
  if (values.snapshots && (i === 1 || i === restarts)) writeHeapSnapshot(join(out, `after-${i}.heapsnapshot`));
}
await server.close();
process.exit(0);
