/**
 * `npm run version-packages`: `changeset version`, refused while pending changesets exist and none
 * is picked as a highlight. `-- --no-picks` versions anyway.
 */
import { execSync } from 'node:child_process';
import { readPending } from './pick.ts';

const { pending, unmarked } = readPending();
if (unmarked.length) {
  console.error(`[version] ${unmarked.length} changeset(s) have no valid entry marker; run npm run check:changesets.`);
  process.exit(1);
}
if (pending.length && !pending.some((p) => p.meta.pick) && !process.argv.includes('--no-picks')) {
  console.error('[version] no pending changeset is picked as a highlight. Run npm run release:pick first,');
  console.error('          or npm run version-packages -- --no-picks to release without highlights.');
  process.exit(1);
}
execSync('changeset version && npm install --package-lock-only --ignore-scripts', { stdio: 'inherit' });
