/**
 * `npm run version-packages -- --bump <patch|minor|major>`: what `changeset version` does, with
 * every package moved to the next `--bump` version, `patch` when it is not given, rather than the
 * one the highest pending changeset asks for. Each changeset keeps its own level, which its
 * changelog entry is listed under. Refused while pending changesets exist and none is picked as a
 * highlight; `--no-picks` versions anyway.
 */
import { execSync } from 'node:child_process';
import { getPackages } from '@manypkg/get-packages';
import { readConfig } from '@changesets/config';
import { readChangesets } from '@changesets/read';
import { readPreState } from '@changesets/pre';
import { assembleReleasePlan } from '@changesets/assemble-release-plan';
import { applyReleasePlan } from '@changesets/apply-release-plan';
import { readPending } from './pick.ts';
import { releasedAt, LEVELS } from './bumps.mjs';

const args = process.argv.slice(2);
const at = args.indexOf('--bump');
const level = at === -1 ? 'patch' : args[at + 1];
if (!LEVELS.includes(level as (typeof LEVELS)[number])) {
  console.error(`[version] --bump takes ${LEVELS.join(', ')}; got ${JSON.stringify(level)}.`);
  process.exit(1);
}

const { pending, unmarked } = readPending();
if (unmarked.length) {
  console.error(`[version] ${unmarked.length} changeset(s) have no valid entry marker; run npm run check:changesets.`);
  process.exit(1);
}
if (!pending.length) {
  console.error('[version] no pending changesets.');
  process.exit(1);
}
if (!pending.some((p) => p.meta.pick) && !args.includes('--no-picks')) {
  console.error('[version] no pending changeset is picked as a highlight. Run npm run release:pick first,');
  console.error('          or npm run version-packages -- --no-picks to release without highlights.');
  process.exit(1);
}

const cwd = process.cwd();
const packages = await getPackages(cwd);
const { config, errors } = await readConfig(packages.rootDir, packages);
if (errors) {
  console.error(`[version] .changeset/config.json: ${errors.join('; ')}`);
  process.exit(1);
}
const [changesets, preState] = await Promise.all([readChangesets(cwd), readPreState(cwd)]);
const plan = releasedAt(assembleReleasePlan(changesets, packages, config, preState), level);
console.log(`[version] cutting a ${level} release from ${changesets.length} changeset(s): ${[...new Set(plan.releases.map((r) => r.newVersion))].join(', ')}.`);
await applyReleasePlan(plan, packages, config);
execSync('npm install --package-lock-only --ignore-scripts', { stdio: 'inherit' });
