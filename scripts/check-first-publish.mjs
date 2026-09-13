// Refuse to start a release when a workspace has never been published.
//
// npm's OIDC trusted publishing cannot create a package. The release job's
// short-lived token gets `E404: PUT /<name>` — the same status npm returns for
// "no such package", which is what makes it read like a registry outage rather
// than a missing bootstrap. So a first publish must come from a human with
// credentials.
// Tracked upstream as https://github.com/npm/cli/issues/8544, open since 2025-09.
//
// Half of what this comment used to say is no longer true, and the half that is
// left is the half that matters. It said trust config could not be registered
// before the package existed, because npm's UI needs a package to configure.
// `npm trust github <name>` does not: it registered `@weasel-js/kernel3d` on
// 2026-09-13 while the name was still a 404, and `npm trust list` returned a
// real config id for it. Whether an OIDC *publish* can now create the package
// is untested, and not worth testing on a live release — a half-published
// fixed group is what this check exists to prevent.
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
import { isPublished, registryBase } from './lib/registry.mjs';

const warnOnly = process.argv.includes('--warn');

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
    'Then register the trusted publisher so CI owns every publish after this one —',
    'naming the package, or it sweeps all of them with a 2FA challenge each:',
    '',
    ...missing.map((n) => `  node scripts/setup-trusted-publishing.mjs ${n}`),
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
  console.log(`[first-publish] OK — all ${packages.length} publishable package(s) exist on ${registryBase()}.`);
}
