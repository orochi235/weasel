#!/usr/bin/env node
/**
 * Runs vitest in Playwright's Linux image, for the browser tests CI's ubuntu runner fails and a Mac passes.
 * Needs Docker on the machine it runs on; send it to one that has it:
 *
 *   onto do --kind test --node studio --task <name> --expect 15m -- node scripts/browser-linux.mjs [vitest args]
 *
 * With no arguments it runs `--project=browser`. The tree goes in as a tarball, without `node_modules`,
 * `.git` or build output, and `npm ci` installs Linux binaries inside; only the npm cache persists, in the
 * Docker volume `weasel-linux-npm`. `--drop` removes that volume.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const VOLUME = 'weasel-linux-npm';
const args = process.argv.slice(2);
// Docker Desktop's socket, where nothing has linked /var/run/docker.sock to it.
const desktop = join(homedir(), '.docker/run/docker.sock');
const env = !process.env.DOCKER_HOST && !existsSync('/var/run/docker.sock') && existsSync(desktop)
  ? { ...process.env, DOCKER_HOST: `unix://${desktop}` }
  : process.env;
if (spawnSync('docker', ['info'], { env, stdio: 'ignore' }).status !== 0) {
  console.error('browser-linux: no Docker daemon answers here; start Docker on this machine first');
  process.exit(2);
}

if (args[0] === '--drop') {
  const r = spawnSync('docker', ['volume', 'rm', VOLUME], { env, stdio: 'inherit' });
  process.exit(r.status ?? 1);
}

const lock = JSON.parse(readFileSync(resolve(root, 'package-lock.json'), 'utf8'));
const playwright = lock.packages['node_modules/playwright']?.version;
if (!playwright) throw new Error('package-lock.json names no playwright version');
const ci = readFileSync(resolve(root, '.github/workflows/ci.yml'), 'utf8');
const npm = /NPM_VERSION:\s*(\S+)/.exec(ci)?.[1];
const image = `mcr.microsoft.com/playwright:v${playwright}-noble`;
const vitest = (args.length ? args : ['--project=browser']).map((a) => `'${a.replaceAll("'", "'\\''")}'`).join(' ');

const inside = [
  'set -e',
  'mkdir -p /work && tar -x -C /work && cd /work',
  `echo "browser-linux: $(node --version), ${image}"`,
  npm ? `npm install -g --silent npm@${npm}` : 'true',
  'npm ci --no-audit --no-fund --loglevel=error',
  `npx vitest run --reporter=default ${vitest}`,
].join('\n');

const exclude = ['node_modules', '.git', 'dist', 'dist-*', '.claude', 'test-results', 'coverage'].map((p) => `--exclude=${p}`);
const tar = spawn('tar', ['-c', ...exclude, '-C', root, '.'], { stdio: ['ignore', 'pipe', 'inherit'] });
const run = spawn(
  'docker',
  ['run', '--rm', '-i', '--ipc=host', '-e', 'CI=1', '-e', 'NPM_CONFIG_LOGLEVEL=error', '-v', `${VOLUME}:/root/.npm`, image, 'bash', '-c', inside],
  { env, stdio: ['pipe', 'inherit', 'inherit'] },
);
tar.stdout.pipe(run.stdin);
run.on('exit', (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
