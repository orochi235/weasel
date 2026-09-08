// Verify that every publishable workspace's current version is on the registry.
//
// `changeset publish` has twice printed packages under "Successfully published"
// that never reached npm: 1.2.0 shipped without `gestures`, 1.4.3 without `hud`
// and `labkit`. The CLI's progress counter stopped one short of its own summary
// and no npm error appeared anywhere in the log. Re-dispatching the identical
// workflow published the stragglers, so the tarballs and the auth were fine —
// the report was wrong.
//
// So the release job cannot trust what the publish says it did. This asks the
// registry instead, after the fact, and fails naming the packages to
// re-dispatch for. Run it by hand any time to answer "did the last release
// actually land?".
//
// Not a pre-publish gate and not a CI check: between `chore: version packages`
// merging and the publish finishing, the manifests legitimately hold versions
// the registry has never seen.
import { publishableWorkspaces } from './lib/workspaces.mjs';
import { hasVersion, registryBase } from './lib/registry.mjs';

const packages = publishableWorkspaces();
const width = String(packages.length).length;
const missing = [];

for (const [i, { manifest }] of packages.entries()) {
  const { name, version } = manifest;
  const live = await hasVersion(name, version);
  if (!live) missing.push({ name, version });
  const n = String(i + 1).padStart(width, ' ');
  console.log(`[published] ${n}/${packages.length} ${name}@${version} — ${live ? 'ok' : 'MISSING'}`);
}

if (missing.length > 0) {
  console.error(
    [
      '',
      `[published] ${missing.length} of ${packages.length} package(s) are not on ${registryBase()}:`,
      '',
      ...missing.map(({ name, version }) => `  ${name}@${version}`),
      '',
      'The publish reported success for these and the registry disagrees, which',
      'leaves consumers installing a version of the fixed group that cannot',
      'resolve its siblings. Re-dispatch the release workflow — it republishes',
      'only what is missing, and has twice been enough on its own:',
      '',
      '  gh workflow run release.yml',
      '',
      'If a re-dispatch leaves the same packages behind, it is not the flake',
      'this check was written for; read the job log before publishing by hand.',
      '',
    ].join('\n'),
  );
  process.exit(1);
}

console.log(`[published] OK — all ${packages.length} package(s) are live on ${registryBase()}.`);
