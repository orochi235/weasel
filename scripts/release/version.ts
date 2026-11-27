/**
 * `npm run version-packages -- --bump <patch|minor|major>`: what `changeset version` does, with
 * every package moved to the next `--bump` version, `patch` when it is not given, rather than the
 * one the highest pending changeset asks for. Each changeset keeps its own level, which its
 * changelog entry is listed under. Refused while pending changesets exist and none is picked as a
 * highlight; `--no-picks` versions anyway.
 */
import { execSync } from 'node:child_process';
import { registerHooks } from 'node:module';
import { getPackages } from '@manypkg/get-packages';
import { readConfig } from '@changesets/config';
import { readChangesets } from '@changesets/read';
import { readPreState } from '@changesets/pre';
import { assembleReleasePlan } from '@changesets/assemble-release-plan';
import { cli } from '../lib/help.mjs';
import { readPending } from './pick.ts';
import { releasedAt, LEVELS } from './bumps.mjs';

const { values } = cli(import.meta.url, {
  summary:
    'Versions every package at the next --bump level from the pending changesets, as `changeset version` does, and writes their changelogs. Refused while no pending changeset is picked as a highlight.',
  options: {
    bump: { type: 'string', placeholder: `<${LEVELS.join('|')}>`, default: 'patch', description: 'the level every package moves by' },
    'no-picks': { type: 'boolean', description: 'version even though no pending changeset is picked (npm run release:pick)' },
  },
});
const level = values.bump as string;
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
if (!pending.some((p) => p.meta.pick) && !values['no-picks']) {
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
const COMMITS = new URL('./changeset-commits.mjs', import.meta.url).href;
registerHooks({
  resolve: (specifier, context, next) =>
    specifier === '@changesets/git' && context.parentURL?.includes('/@changesets/apply-release-plan/')
      ? { url: COMMITS, shortCircuit: true }
      : next(specifier, context),
});
const { applyReleasePlan } = await import('@changesets/apply-release-plan');
await applyReleasePlan(plan, packages, config);
execSync('npm install --package-lock-only --ignore-scripts', { stdio: 'inherit' });
