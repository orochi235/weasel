// Verify that every publishable workspace's current version is on the registry.
//
//   npm run check:published              one pass — "did the last release land?"
//   npm run check:published -- --wait    poll anything missing for up to 60 minutes
//   npm run check:published -- --wait=20 ... or for that many minutes
//
// `changeset publish` can print a package under "Successfully published" that
// never reached npm, with no error in the log, so the release job asks the
// registry instead.
//
// The release job runs this with `--wait`: npm holds a fresh upload as staged,
// invisible to every read (npm/cli#9889), for as long as 55 minutes.
//
// Not a pre-publish gate and not a CI check: between `chore: version packages`
// merging and the publish finishing, the manifests legitimately hold versions
// the registry has never seen.
import { publishableWorkspaces } from './lib/workspaces.mjs';
import { hasVersion, registryBase } from './lib/registry.mjs';
import { awaitPublished, waitMinutes } from './lib/await-published.mjs';

const minutes = waitMinutes(process.argv.slice(2), { label: 'check:published', defaultMinutes: 60 });
const packages = publishableWorkspaces().map(({ manifest: { name, version } }) => ({ name, version }));

const { missing } = await awaitPublished(packages, {
  // When waiting, the polling loop does the retrying; one pass keeps the short
  // retry that covers read-replica lag.
  lookup: ({ name, version }) => (minutes > 0 ? hasVersion(name, version, { attempts: 1 }) : hasVersion(name, version)),
  budgetMs: minutes * 60_000,
});

// A version npm is still holding as staged cannot be republished, so advice to
// re-dispatch is only right once the staging window has passed.
const withoutWaiting = [
  'If the publish finished less than an hour ago, npm may still be holding',
  'these as staged. Do not re-dispatch yet; wait them out first:',
  '',
  '  npm run check:published -- --wait',
];
const afterWaiting = [
  'The staging window has passed. Re-dispatch the release workflow; it',
  'republishes only what is missing, and a version npm still holds as staged',
  'is reported as held rather than failing the run:',
  '',
  '  gh workflow run release.yml',
  '',
  'If a re-dispatch leaves the same packages behind, npm may have wedged the',
  'version (npm/cli#9889: "Cannot publish over previously staged version" for',
  'a version that never lists). A new patch release is the known way out;',
  'read the job log first.',
];

if (missing.length > 0) {
  const waited = minutes > 0 ? ` after waiting ${minutes} minutes` : '';
  console.error(
    [
      '',
      `[published] ${missing.length} of ${packages.length} package(s) are not on ${registryBase()}${waited}:`,
      '',
      ...missing.map(({ name, version }) => `  ${name}@${version}`),
      '',
      'Consumers installing this release cannot resolve these siblings.',
      '',
      ...(minutes > 0 ? afterWaiting : withoutWaiting),
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`[published] OK — all ${packages.length} package(s) are live on ${registryBase()}.`);
