/**
 * Builds one generated input again and again in one process with rolldown's own API (or esbuild's, as a control),
 * closing every build and dropping every reference, and records memory after a forced GC: whether repeated builds,
 * outside vite, keep native memory.
 *
 *   node --expose-gc scripts/probe-rolldown-rebuilds.mjs [--bundler rolldown|esbuild] [--iters 60] [--modules 1500]
 *     [--from <dir to resolve the bundler from, default this repo>] [--label <text>] [--out <dir>]
 *
 * `--out` defaults to node_modules/.probe-rolldown-rebuilds; it and the input generated in `<out>-input` are cleared
 * on each run. One JSON line per iteration goes to `<out>/runs.jsonl` as it finishes. On macOS each line carries
 * vmmap's physical footprint and the dirty size of mimalloc's regions (`lib/vmmap-regions.mjs`), and on Linux the
 * anonymous resident size. `probe-rolldown-rebuilds-linux.sh` runs it under Linux. Runs kept:
 * `probe-rolldown-rebuilds.runs.jsonl`, with mimalloc's exit stats from `MIMALLOC_SHOW_STATS=1`.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { arch, cpus, hostname, loadavg, platform, totalmem } from 'node:os';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { nativeRegions, retagMimalloc } from './lib/vmmap-regions.mjs';

retagMimalloc();

const { values } = parseArgs({
  options: {
    bundler: { type: 'string', default: 'rolldown' },
    iters: { type: 'string', default: '60' },
    modules: { type: 'string', default: '1500' },
    from: { type: 'string', default: resolve(import.meta.dirname, '..') },
    label: { type: 'string', default: '' },
    out: { type: 'string', default: 'node_modules/.probe-rolldown-rebuilds' },
  },
});
const gc = globalThis.gc;
if (!gc) throw new Error('run with node --expose-gc');
const iters = Number(values.iters);
const out = resolve(values.out);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const src = `${out}-input`;
rmSync(src, { recursive: true, force: true });
mkdirSync(src, { recursive: true });

// A tree of TypeScript modules: each imports two later ones and exports a class, an interface and a function.
const n = Number(values.modules);
for (let i = 0; i < n; i++) {
  const deps = [2 * i + 1, 2 * i + 2].filter((d) => d < n);
  writeFileSync(join(src, `m${i}.ts`), [
    ...deps.map((d) => `import { f${d}, C${d} } from './m${d}';`),
    `export interface Shape${i} { id: number; name: string; tags: string[]; next?: Shape${i} }`,
    `export class C${i} {`,
    `  private items: Shape${i}[] = [];`,
    `  add(s: Shape${i}): number { this.items.push(s); return this.items.length; }`,
    `  render(): string { return this.items.map((s) => \`<li data-id="\${s.id}">\${s.name}: \${s.tags.join(', ')}</li>\`).join(''); }`,
    '}',
    `export function f${i}(x: number): number {`,
    `  const c = new C${i}();`,
    `  for (let k = 0; k < x; k++) c.add({ id: k, name: 'item ${i}-' + k, tags: ['a', 'b', String(k % 7)] });`,
    `  return c.render().length${deps.map((d) => ` + f${d}(x - 1) + new C${d}().add({ id: ${d}, name: 'n', tags: [] })`).join('')};`,
    '}',
    `export const table${i} = ${JSON.stringify(Array.from({ length: 20 }, (_, k) => `row ${i}.${k} lorem ipsum dolor sit amet`))};`,
  ].join('\n'));
}
const entry = join(src, 'm0.ts');

const req = createRequire(join(resolve(values.from), 'package.json'));
const versionOf = (name) => JSON.parse(readFileSync(req.resolve(`${name}/package.json`), 'utf8')).version;
const bundler = values.bundler;
const version = versionOf(bundler);
const build = bundler === 'rolldown'
  ? await (async () => {
    const { rolldown } = await import(req.resolve('rolldown'));
    return async () => {
      const bundle = await rolldown({ input: entry, logLevel: 'silent' });
      await bundle.write({ dir: join(out, 'dist'), format: 'esm', sourcemap: true });
      await bundle.close();
    };
  })()
  : bundler === 'esbuild'
    ? await (async () => {
      const esbuild = await import(req.resolve('esbuild'));
      return async () => {
        await esbuild.build({ entryPoints: [entry], bundle: true, outdir: join(out, 'dist'), format: 'esm', sourcemap: true, logLevel: 'silent' });
      };
    })()
    : (() => { throw new Error(`unknown --bundler ${bundler}`); })();

const mb = (bytes) => +(bytes / 2 ** 20).toFixed(1);
/** OS threads, and on Linux, which has no vmmap, the anonymous resident memory a native allocator's pages land in. */
const osStats = () => {
  if (process.platform === 'linux') {
    const status = readFileSync('/proc/self/status', 'utf8');
    const kb = /^RssAnon:\s+(\d+) kB/m.exec(status)?.[1];
    return { threads: Number(/^Threads:\s+(\d+)/m.exec(status)?.[1]), rssAnonMB: kb ? mb(Number(kb) * 1024) : undefined };
  }
  if (process.platform === 'darwin') {
    return { threads: execFileSync('ps', ['-M', '-p', String(process.pid)], { encoding: 'utf8' }).trim().split('\n').length - 1 };
  }
  return {};
};

console.log(`probe-rolldown-rebuilds: ${bundler} ${version}, ${n} modules, ${iters} iterations, node ${process.version}, ${platform()} ${arch()}`);
const t0 = performance.now();
for (let iter = 0; iter <= iters; iter++) {
  const t = performance.now();
  if (iter > 0) await build();
  const ms = Math.round(performance.now() - t);
  await new Promise((r) => setTimeout(r, 250));
  gc();
  gc();
  const m = process.memoryUsage();
  const row = {
    probe: 'probe-rolldown-rebuilds', label: values.label, bundler, version, modules: n, iter, ms,
    rssMB: mb(m.rss), heapUsedMB: mb(m.heapUsed), heapTotalMB: mb(m.heapTotal), externalMB: mb(m.external),
    arrayBuffersMB: mb(m.arrayBuffers), ...nativeRegions(), ...osStats(),
    mimallocEnv: Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('MIMALLOC_'))),
    host: hostname(), platform: platform(), arch: arch(), cores: cpus().length, memGB: Math.round(totalmem() / 2 ** 30),
    load1: +loadavg()[0].toFixed(2), node: process.version, at: new Date().toISOString(),
  };
  appendFileSync(join(out, 'runs.jsonl'), JSON.stringify(row) + '\n');
  console.log(`onto: progress ${iter}/${iters}`);
  console.log(`${String(iter).padStart(3)}/${iters}  rss ${row.rssMB.toFixed(1).padStart(7)} MB  heap ${row.heapUsedMB.toFixed(1).padStart(6)} MB  ext ${row.externalMB.toFixed(1).padStart(5)} MB  ab ${row.arrayBuffersMB.toFixed(1).padStart(5)} MB  threads ${String(row.threads).padStart(3)}  footprint ${String(row.footprintMB ?? '-').padStart(7)}  mimalloc ${String(row.mimallocDirtyMB ?? '-').padStart(7)}  ${String(ms).padStart(5)} ms`);
}
console.log(`done in ${((performance.now() - t0) / 1000).toFixed(1)} s; records in ${join(out, 'runs.jsonl')}`);
