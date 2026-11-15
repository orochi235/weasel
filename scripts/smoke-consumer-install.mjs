#!/usr/bin/env node
// Small consumers under `tests/consumers/`, each copied into a fresh directory outside the repo and
// installed the way an app installs weasel: `npm install` of its own manifest, with every
// `@weasel-js/*` package it reaches taken from a packed tarball and everything else from the
// registry. Nothing hoisted from the workspace is reachable, so a package that imports a dependency
// it does not declare fails here even when the full set would have supplied it. Each consumer then
// typechecks on NodeNext and Bundler resolution with its own compiler and runs.
//
//   node scripts/smoke-consumer-install.mjs           # pack what the consumers need, then run them
//   node scripts/smoke-consumer-install.mjs --keep    # leave the temp directory for a look
//
// smoke-consumer-bundle.mjs calls `smokeInstalledConsumers` with the tarballs it has already packed.
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { packTarballs } from './lib/pack-tree.mjs';
import { closure, diagnostics } from './smoke-consumer-types.mjs';

/** Each consumer: its directory, and the commands that build and run it once installed. */
export const CONSUMERS = [
  {
    dir: 'tests/consumers/gem-extension',
    about: 'a public-only extension (node kind, action, tools, properties) driven under jsdom',
    build: ['npm', 'run', '--silent', 'build'],
    run: ['npm', 'run', '--silent', 'scenario'],
  },
];

const RESOLUTIONS = [
  { name: 'NodeNext', module: 'NodeNext', moduleResolution: 'NodeNext' },
  { name: 'Bundler', module: 'ESNext', moduleResolution: 'Bundler' },
];

/** The tarball `npm pack` writes for `manifest`. */
export const tarballName = ({ name, version }) => `${name.replace(/^@/, '').replace('/', '-')}-${version}.tgz`;

/** The workspace packages `manifest`'s `@weasel-js/*` dependencies reach, as directory names under `packages/`. */
async function weaselClosure(repoRoot, manifest) {
  const direct = Object.keys({ ...manifest.dependencies, ...manifest.devDependencies, ...manifest.peerDependencies })
    .filter((d) => d.startsWith('@weasel-js/'))
    .map((d) => d.slice('@weasel-js/'.length));
  return direct.length ? closure(repoRoot, direct) : [];
}

/** `manifest` with each `@weasel-js/*` package it reaches, directly or not, pinned to its tarball. */
function pinToTarballs(manifest, manifests, tarballDir) {
  const tarball = (name) => {
    const m = manifests.get(name);
    return `file:${join(tarballDir, tarballName(m))}`;
  };
  const pin = (deps) => deps && Object.fromEntries(Object.entries(deps).map(([d, v]) => [d, d.startsWith('@weasel-js/') ? tarball(d) : v]));
  return {
    ...manifest,
    dependencies: pin(manifest.dependencies),
    devDependencies: pin(manifest.devDependencies),
    overrides: Object.fromEntries([...manifests.keys()].map((name) => [name, tarball(name)])),
  };
}

const run = (cmd, cwd, label) => {
  try {
    return execFileSync(cmd[0], cmd.slice(1), { cwd, encoding: 'utf8', stdio: 'pipe', env: { ...process.env, npm_config_loglevel: 'error' } });
  } catch (err) {
    const e = new Error(`${label} failed:\n${String(err.stdout ?? '')}${String(err.stderr ?? '')}`);
    e.command = cmd.join(' ');
    throw e;
  }
};

/**
 * Installs, typechecks, builds, and runs every consumer in {@link CONSUMERS}.
 * @param {{ repoRoot: string, workDir: string, tarballDir: string, fail: (msg: string, detail?: string) => never }} ctx
 */
export async function smokeInstalledConsumers({ repoRoot, workDir, tarballDir, fail }) {
  for (const [i, consumer] of CONSUMERS.entries()) {
    const tag = `consumer ${i + 1}/${CONSUMERS.length} ${consumer.dir}`;
    const source = join(repoRoot, consumer.dir);
    const dir = join(workDir, 'consumers', consumer.dir.split('/').pop());
    await mkdir(dirname(dir), { recursive: true });
    await cp(source, dir, { recursive: true, filter: (p) => !/[\\/](node_modules|dist)$/.test(p) });

    const manifest = JSON.parse(await readFile(join(dir, 'package.json'), 'utf8'));
    const reached = await weaselClosure(repoRoot, manifest);
    const manifests = new Map();
    for (const d of reached) {
      const m = JSON.parse(await readFile(join(repoRoot, 'packages', d, 'package.json'), 'utf8'));
      if (!existsSync(join(tarballDir, tarballName(m)))) fail(`${tag}: no tarball for ${m.name} in ${tarballDir}`);
      manifests.set(m.name, m);
    }
    await writeFile(join(dir, 'package.json'), JSON.stringify(pinToTarballs(manifest, manifests, tarballDir), null, 2));

    try {
      // Not --prefer-offline: a cached packument can lack a version a peer range needs, and npm reports that as ERESOLVE.
      run(['npm', 'install', '--no-audit', '--no-fund'], dir, 'npm install');
      console.log(`[smoke] ${tag}: installed ${manifests.size} weasel tarballs and its declared dependencies (${consumer.about}).`);

      const tsc = join(dir, 'node_modules', '.bin', 'tsc');
      for (const mode of RESOLUTIONS) {
        const config = `tsconfig.smoke-${mode.name.toLowerCase()}.json`;
        await writeFile(join(dir, config), JSON.stringify({
          extends: './tsconfig.json',
          // Library checking on, unlike the consumer's own build: an error in a weasel declaration fails here.
          compilerOptions: { module: mode.module, moduleResolution: mode.moduleResolution, noEmit: true, skipLibCheck: false },
        }));
        const { ours, theirs } = diagnostics(tsc, config, dir);
        if (ours.length) fail(`${tag}: typecheck FAILED under ${mode.name} resolution:`, ours.join('\n'));
        console.log(`[smoke] ${tag}: typecheck OK under ${mode.name}` +
          (theirs.length ? `; ${theirs.length} error(s) in third-party declarations, not gated.` : '.'));
      }
      run(consumer.build, dir, 'build');
      const out = run(consumer.run, dir, 'run');
      console.log(out.trimEnd().split('\n').map((line) => `[smoke] ${tag}: ${line}`).join('\n'));
    } catch (err) {
      fail(`${tag}: ${err.command ?? ''} FAILED`, err.message);
    }
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
  const keep = process.argv.includes('--keep');
  const workDir = await mkdtemp(join(tmpdir(), 'weasel-consumers-'));
  const done = () => {
    if (keep) console.log(`[smoke] consumers left at ${workDir}`);
    else rmSync(workDir, { recursive: true, force: true });
  };
  const fail = (msg, detail) => {
    console.error(`[smoke] ${msg}\n`);
    if (detail) console.error(detail);
    done();
    process.exit(1);
  };
  const dirs = new Set();
  for (const consumer of CONSUMERS) {
    const manifest = JSON.parse(await readFile(join(repoRoot, consumer.dir, 'package.json'), 'utf8'));
    for (const d of await weaselClosure(repoRoot, manifest)) dirs.add(d);
  }
  const tarballDir = join(workDir, 'tarballs');
  await packTarballs(repoRoot, [...dirs].sort(), tarballDir);
  console.log(`[smoke] packed ${dirs.size} packages for ${CONSUMERS.length} consumer(s).`);
  await smokeInstalledConsumers({ repoRoot, workDir, tarballDir, fail });
  done();
}
