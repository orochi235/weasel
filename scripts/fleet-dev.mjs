#!/usr/bin/env node
/**
 * Serves this checkout's dev servers from a fleet node instead of this machine, and keeps them current.
 *
 * Installs into one scratch tree on the node (`weasel-dev`, so a node holds at most one), runs the named apps there
 * as one onto service, prints their addresses, and syncs every edit made here until Ctrl-C, which stops the service.
 * `--drop` also removes the tree from the node.
 *
 *   npm run dev:fleet                         # draw and forge
 *   npm run dev:fleet -- draw site --node teitou
 *   npm run dev:fleet -- --drop
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ports from './dev-ports.json' with { type: 'json' };

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const APPS = {
  draw: { config: 'apps/draw/vite.config.ts', port: ports.draw, path: '/weasel/draw/' },
  forge: { config: 'apps/forge/vite.config.ts', port: ports.forge, path: '/' },
  site: { config: 'vite.config.ts', port: ports.site, path: '/' },
  chart: { config: 'apps/chart/vite.config.ts', port: ports.chart, path: '/' },
  'theme-editor': { config: 'apps/theme-editor/vite.config.ts', port: ports.themeEditor, path: '/' },
};

const args = process.argv.slice(2);
const flag = (name) => {
  const at = args.indexOf(name);
  return at < 0 ? undefined : args.splice(at, 2)[1];
};
const drop = args.includes('--drop') && args.splice(args.indexOf('--drop'), 1);
const pinned = flag('--node');
const tree = flag('--tree') ?? 'weasel-dev';
const names = args.length ? args : ['draw', 'forge'];
for (const name of names) if (!APPS[name]) throw new Error(`fleet-dev: no app "${name}"; one of ${Object.keys(APPS).join(', ')}`);

const git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim();
const onto = (a, opts = {}) => spawnSync('onto', a, { cwd: ROOT, encoding: 'utf8', stdio: ['inherit', 'pipe', 'pipe'], ...opts });
const say = (line) => console.log(`fleet-dev: ${line}`);

const nodeOfService = () => onto(['service', 'where', tree]).stdout.trim().split(/\s+/)[0] || undefined;

if (drop) {
  const node = pinned ?? nodeOfService();
  onto(['service', 'down', '--drop', tree], { stdio: 'inherit' });
  if (node) onto(['drop', node, tree], { stdio: 'inherit' });
  process.exit(0);
}

// Reinstall only when the lockfile differs from the one last installed, so a warm tree starts in seconds.
const base = git('merge-base', 'HEAD', 'origin/main');
const install = 'cmp -s package-lock.json node_modules/.fleet-dev-lock || (npm ci --no-audit --no-fund && cp package-lock.json node_modules/.fleet-dev-lock)';
say(`installing into ${tree} on ${pinned ?? 'the node onto picks'}`);
const started = Date.now();
const ran = onto(['do', '--ref', base, '--in', tree, '--kind', 'build', '--icon', 'hammer', '--task', `${tree}-install`,
  '--about', 'Installs dependencies in the scratch tree fleet-dev serves dev servers from.',
  ...(pinned ? ['--node', pinned] : []), '--', 'sh', '-c', install]);
process.stdout.write(ran.stdout);
process.stderr.write(ran.stderr);
if (ran.status !== 0) process.exit(ran.status ?? 1);
const node = pinned ?? (ran.stdout + ran.stderr).match(/^(\S+)\s+chosen:/m)?.[1];
if (!node) throw new Error('fleet-dev: could not tell which node onto picked; pass --node');
say(`installed on ${node} in ${Math.round((Date.now() - started) / 1000)}s`);

// One service, since a node runs one job per tree. WAKE_EXTRA keeps each vite from taking over another copy's port.
const servers = names.map((n) => `"WAKE_EXTRA=${APPS[n].port} npx vite --config ${APPS[n].config} --port ${APPS[n].port}"`);
onto(['service', 'down', tree]);
const up = onto(['service', 'up', tree, '--in', tree, '--prefer', node, ...names.flatMap((n) => ['--port', String(APPS[n].port)]),
  '--icon', 'rectangle.and.pencil.and.ellipsis', '--about', `Dev servers (${names.join(', ')}) for a session driving them from another machine.`,
  '--', 'sh', '-c', `npx concurrently -n ${names.join(',')} ${servers.join(' ')}`], { stdio: 'inherit' });
if (up.status !== 0) process.exit(up.status ?? 1);
for (const n of names) say(`${n}  http://${node}.local:${APPS[n].port}${APPS[n].path}`);

const stop = () => {
  onto(['service', 'down', tree], { stdio: 'inherit' });
  process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
say('syncing edits; Ctrl-C stops the servers');
spawn('onto', ['sync', '--watch', '--alone', '--ref', base, '--in', tree, node], { cwd: ROOT, stdio: 'inherit' }).on('close', stop);
