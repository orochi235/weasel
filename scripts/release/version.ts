/**
 * `npm run version-packages -- --bump <patch|minor|major>`: `changeset version` at the level the
 * release is cut at, `patch` when `--bump` is not given. Every pending changeset is rewritten to
 * that level first, since every package is in one `fixed` group and the highest level among them
 * would otherwise decide. Refused while pending changesets exist and none is picked as a
 * highlight; `--no-picks` versions anyway.
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readPending, DIR } from './pick.ts';
import { atLevel, LEVELS } from './bumps.mjs';

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
if (pending.length && !pending.some((p) => p.meta.pick) && !args.includes('--no-picks')) {
  console.error('[version] no pending changeset is picked as a highlight. Run npm run release:pick first,');
  console.error('          or npm run version-packages -- --no-picks to release without highlights.');
  process.exit(1);
}

console.log(`[version] cutting a ${level} release from ${pending.length} changeset(s).`);
for (const p of pending) writeFileSync(join(DIR, p.file), atLevel(p.text, level));
try {
  execSync('changeset version && npm install --package-lock-only --ignore-scripts', { stdio: 'inherit' });
} catch (err) {
  for (const p of pending) writeFileSync(join(DIR, p.file), p.text);
  throw err;
}
