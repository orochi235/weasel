#!/usr/bin/env node
// Install every published package from the registry, into an empty tree outside
// the repo, and check that npm can actually resolve the release.
//
// `check:published` asks whether each version exists. This asks the question a
// consumer asks, which is not the same one: the fixed group pins siblings by
// range, so one package missing makes `npm i @weasel-js/core` fail with
// ETARGET while sixteen of the eighteen versions are perfectly present. That is
// how 1.2.0 was found — by a person installing it, days later.
//
// The cache is a fresh directory on purpose. `npm view` reported ETARGET for a
// package that was already live while chasing the 1.4.3 stragglers, so a check
// that can be answered from anything cached locally is not worth running.
//
// Complements `test:smoke:consumer`, which bundles and typechecks against
// locally packed tarballs. That one proves the tarballs are right; this one
// proves the registry is serving them.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishableWorkspaces } from './lib/workspaces.mjs';

const packages = publishableWorkspaces().map(({ manifest }) => ({
  name: manifest.name,
  version: manifest.version,
}));

const workDir = mkdtempSync(join(tmpdir(), 'weasel-registry-smoke-'));
const cacheDir = join(workDir, 'npm-cache');
const keep = process.argv.includes('--keep');

// No `dependencies` — the install below is the whole point, and pre-declaring
// them would let a lockfile or a workspace link answer instead of the registry.
writeFileSync(
  join(workDir, 'package.json'),
  JSON.stringify({ name: 'weasel-registry-smoke', private: true, version: '0.0.0' }, null, 2),
);

const specs = packages.map(({ name, version }) => `${name}@${version}`);
console.log(`[registry-smoke] installing ${specs.length} package(s) into ${workDir}`);

try {
  execFileSync('npm', ['install', '--no-audit', '--no-fund', '--loglevel', 'error', ...specs], {
    cwd: workDir,
    stdio: 'inherit',
    env: { ...process.env, npm_config_cache: cacheDir },
  });
} catch {
  console.error(
    [
      '',
      '[registry-smoke] npm could not install the release from the registry.',
      '',
      'Read the error above for which specifier failed. An ETARGET on a package',
      'whose version check passed means the release is internally inconsistent —',
      'something depends on a range nothing published satisfies.',
      '',
    ].join('\n'),
  );
  if (!keep) rmSync(workDir, { recursive: true, force: true });
  process.exit(1);
}

// The install succeeding is most of the answer, but npm is happy to satisfy a
// spec from somewhere other than where it was asked. Confirm each package
// landed at the exact version main claims.
const wrong = [];
const width = String(packages.length).length;

for (const [i, { name, version }] of packages.entries()) {
  const manifestPath = join(workDir, 'node_modules', ...name.split('/'), 'package.json');
  const installed = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, 'utf8')).version
    : null;
  if (installed !== version) wrong.push({ name, want: version, got: installed });
  const n = String(i + 1).padStart(width, ' ');
  const verdict = installed === version ? 'ok' : `WANTED ${version}, GOT ${installed ?? 'nothing'}`;
  console.log(`[registry-smoke] ${n}/${packages.length} ${name}@${installed ?? '-'} — ${verdict}`);
}

if (!keep) rmSync(workDir, { recursive: true, force: true });

if (wrong.length > 0) {
  console.error(
    [
      '',
      `[registry-smoke] ${wrong.length} package(s) did not install at the version main claims:`,
      '',
      ...wrong.map(({ name, want, got }) => `  ${name} — wanted ${want}, got ${got ?? 'nothing'}`),
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`[registry-smoke] OK — a clean install of all ${packages.length} package(s) resolves.`);
