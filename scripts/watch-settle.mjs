#!/usr/bin/env node
/**
 * Saves a module twice in quick succession on a live vite dev server and reports which text it serves once idle.
 * chokidar drops a `change` that lands within 50 ms of the last one it reported, so a page that re-fetches the
 * module between the two saves keeps the first text cached until the next save.
 *
 *   node scripts/watch-settle.mjs [--settle] [--trials 8] [--gap 25] [--idle 1500] [--out <file.jsonl>]
 *   onto do --kind test --node studio -- node scripts/watch-settle.mjs --linux [same flags]
 *
 * Each trial is a fresh module on one server, saved once by rename-over and once in place:
 *   double  save; fetch 5 ms after the first `change`; save again once that fetch is back and `--gap` ms have
 *           passed; fetch again after `--idle` ms. The second save lands after the first text is cached again.
 *   single  save once and poll every 2 ms until the new text is served: the save-to-served latency.
 * `--settle` starts the server with the repo's dev-server watch settings (`scripts/vite-watch.ts`). `--linux`
 * reruns this script in `node:26-alpine` under Docker, with the vite version the lockfile names.
 */
import { spawn, spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdtempSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 ? argv[i + 1] : fallback;
};
const trials = Number(opt('trials', 8));
const gap = Number(opt('gap', 25));
const idle = Number(opt('idle', 1500));
const settle = flag('settle');
const out = opt('out');
const root = resolve(import.meta.dirname, '..');

if (flag('linux')) {
  process.exit(await inDocker());
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { createServer, version } = await import('vite');
const { devWatch } = await import('./vite-watch.ts');

const dir = realpathSync(mkdtempSync(join(tmpdir(), 'watch-settle-')));
const server = await createServer({
  root: dir,
  configFile: false,
  plugins: settle ? [devWatch()] : [],
  server: { port: 0, host: '127.0.0.1', ws: false },
  appType: 'custom',
  optimizeDeps: { noDiscovery: true },
  logLevel: 'silent',
});
await server.listen();
const base = `http://127.0.0.1:${server.httpServer.address().port}`;
const fetchText = async (name) => (await fetch(`${base}/${name}`)).text();
const conditions = { platform: process.platform, arch: process.arch, node: process.version, vite: version, settle, gap, idle };
console.log(`watch-settle: ${JSON.stringify(conditions)}`);

const writers = {
  rename: (file, text) => {
    writeFileSync(`${file}.tmp`, text);
    renameSync(`${file}.tmp`, file);
  },
  inplace: (file, text) => writeFileSync(file, text),
};
const body = (v) => `export const v = '${v}';\n`;
const served = (code) => /v = "?'?(v\d)/.exec(code)?.[1] ?? '?';

/** Writes `name`, waits for the watcher to add it, and fetches it so the module graph caches its transform. */
async function seed(name) {
  const file = join(dir, name);
  const added = new Promise((r) => {
    const on = (p) => p === file && (server.watcher.off('add', on), r());
    server.watcher.on('add', on);
  });
  writeFileSync(file, body('v0'));
  await Promise.race([added, sleep(3000)]);
  await sleep(200);
  if (served(await fetchText(name)) !== 'v0') throw new Error(`${name} did not serve its first text`);
  return file;
}

const firstChange = (file) =>
  new Promise((r) => {
    const on = (p) => p === file && (server.watcher.off('change', on), r(performance.now()));
    server.watcher.on('change', on);
  });

async function double(name, write) {
  const file = await seed(name);
  const changed = firstChange(file);
  const t0 = performance.now();
  const since = () => Math.round(performance.now() - t0);
  const changes = [];
  const log = (p) => p === file && changes.push(since());
  server.watcher.on('change', log);
  write(file, body('v1'));
  const fetched = changed.then(async (at) => {
    await sleep(5);
    return { changeMs: Math.round(at - t0), early: served(await fetchText(name)) };
  });
  const early = await Promise.race([fetched, sleep(3000).then(() => ({ changeMs: null, early: null }))]);
  if (since() < gap) await sleep(gap - since());
  const secondMs = since();
  write(file, body('v2'));
  await sleep(idle);
  server.watcher.off('change', log);
  const final = served(await fetchText(name));
  return { ...early, secondMs, changes, final, stale: final !== 'v2' };
}

async function single(name, write) {
  const file = await seed(name);
  const t0 = performance.now();
  write(file, body('v1'));
  while (performance.now() - t0 < 5000) {
    if (served(await fetchText(name)) === 'v1') return { latencyMs: Math.round(performance.now() - t0) };
    await sleep(2);
  }
  return { latencyMs: null };
}

let n = 0;
for (let t = 1; t <= trials; t++) {
  for (const mode of Object.keys(writers)) {
    const d = await double(`d${t}-${mode}.js`, writers[mode]);
    const s = await single(`s${t}-${mode}.js`, writers[mode]);
    const record = { ...conditions, trial: t, mode, ...d, ...s };
    n++;
    console.log(
      `${String(n).padStart(2)}/${trials * 2} ${mode.padEnd(7)} first change ${String(d.changeMs ?? '-').padStart(4)} ms, ` +
        `early ${d.early ?? '-'}, second save ${String(d.secondMs).padStart(4)} ms, changes at [${d.changes.join(', ')}] ms, after idle ${d.final}${d.stale ? ' STALE' : '      '}, single save served in ${String(s.latencyMs ?? '-').padStart(4)} ms`,
    );
    console.log(`record ${JSON.stringify(record)}`);
    if (out) appendFileSync(out, JSON.stringify(record) + '\n');
  }
}
await server.close();
rmSync(dir, { recursive: true, force: true });

async function inDocker() {
  const desktop = join(homedir(), '.docker/run/docker.sock');
  const env = !process.env.DOCKER_HOST && !existsSync('/var/run/docker.sock') && existsSync(desktop)
    ? { ...process.env, DOCKER_HOST: `unix://${desktop}` }
    : process.env;
  if (spawnSync('docker', ['info'], { env, stdio: 'ignore' }).status !== 0) {
    console.error('watch-settle: no Docker daemon answers here; start Docker on this machine first');
    return 2;
  }
  const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
  const vite = lock.packages['node_modules/vite']?.version;
  const rest = argv.filter((a) => a !== '--linux' && a !== '--out' && a !== out).map((a) => `'${a}'`).join(' ');
  const inside = [
    'set -e',
    'mkdir -p /w && cd /w && tar -x && echo \'{"type":"module"}\' > package.json',
    `npm i --silent --no-audit --no-fund vite@${vite} >/dev/null`,
    `node scripts/watch-settle.mjs ${rest}`,
  ].join('\n');
  const tar = spawn('tar', ['-c', '-C', root, 'scripts/watch-settle.mjs', 'scripts/vite-watch.ts'], { stdio: ['ignore', 'pipe', 'inherit'] });
  const run = spawn('docker', ['run', '--rm', '-i', 'node:26-alpine', 'sh', '-c', inside], { env, stdio: ['pipe', 'pipe', 'inherit'] });
  tar.stdout.pipe(run.stdin);
  let pending = '';
  run.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
    const lines = (pending + chunk).split('\n');
    pending = lines.pop();
    if (out) for (const line of lines) if (line.startsWith('record ')) appendFileSync(out, line.slice(7) + '\n');
  });
  return new Promise((r) => run.on('exit', (code) => r(code ?? 1)));
}
