// Refuse to start a release when a workspace has never been published.
//
// npm's OIDC trusted publishing cannot create a package: the trusted publisher
// is configured per package in npm's UI, and the UI needs the package to exist
// first. So a first publish must come from a human with credentials, and the
// release job's short-lived OIDC token gets `E404: PUT /<name>` instead — the
// same status npm returns for "no such package", which is what makes it read
// like a registry outage rather than a missing bootstrap.
// Tracked upstream as https://github.com/npm/cli/issues/8544, open since 2025-09.
//
// The damage is that `changeset publish` is not atomic. It publishes in
// dependency order and stops at the first failure, so a new package strands the
// release halfway: some of the fixed group at the new version, the rest at the
// old one, and the registry disagreeing with `main`. That happened twice in two
// releases — 1.4.0-pre.0 died on `@weasel-js/loupe`, 1.4.0-pre.1 on
// `@weasel-js/cursor`, nine packages published each time.
//
// This asks the one question that predicts it, before anything ships.
import { publishableWorkspaces } from './lib/workspaces.mjs';

const REGISTRY = process.env.npm_config_registry ?? 'https://registry.npmjs.org';
const warnOnly = process.argv.includes('--warn');

/**
 * Whether the registry has heard of a package at all.
 *
 * A first publish takes a minute or two to reach the read replicas, so a 404
 * right after one is indistinguishable from a package that was never published.
 * Retrying costs seconds and removes a whole class of false alarm.
 */
async function isPublished(name, { attempts = 3, delayMs = 4000 } = {}) {
  const url = `${REGISTRY.replace(/\/$/, '')}/${name.replace('/', '%2f')}`;
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { method: 'GET', headers: { accept: 'application/json' } });
    if (res.status === 200) return true;
    if (res.status !== 404) {
      throw new Error(`${name}: registry answered ${res.status} ${res.statusText}`);
    }
    if (attempt >= attempts) return false;
    await new Promise((r) => setTimeout(r, delayMs));
  }
}

const packages = publishableWorkspaces();
const missing = [];

for (const [i, { manifest }] of packages.entries()) {
  const name = manifest.name;
  const published = await isPublished(name);
  if (!published) missing.push(name);
  console.log(`[first-publish] ${i + 1}/${packages.length} ${name} — ${published ? 'ok' : 'NEVER PUBLISHED'}`);
}

if (missing.length > 0) {
  const lines = [
    `[first-publish] ${missing.length} package(s) have never been published:`,
    '',
    ...missing.map((n) => `  ${n}`),
    '',
    'The release job publishes over OIDC, which cannot create a package, so it',
    'would fail on these after publishing their siblings and leave the registry',
    'split across two versions. Publish each one once by hand, from a checkout',
    'with the version the release is about to cut:',
    '',
    ...missing.map((n) => `  npm publish -w ${n} --tag pre --provenance=false`),
    '',
    '(provenance is off because npm only attests from CI; the release job keeps it.)',
    'Then register the trusted publisher so CI owns every publish after this one:',
    '',
    '  node scripts/setup-trusted-publishing.mjs',
    '',
  ];
  const report = lines.join('\n');
  if (warnOnly) {
    console.warn(report);
  } else {
    console.error(report);
    process.exit(1);
  }
} else {
  console.log(`[first-publish] OK — all ${packages.length} publishable package(s) exist on ${REGISTRY}.`);
}
