/**
 * `npm run check:changesets`: every pending changeset carries a valid entry marker and reads as
 * one change. The writing rules behind each check are in `docs/releasing.md` ("Writing a
 * changeset").
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isChangesetFile } from './bumps.mjs';
import { lintChangeset } from './lint.ts';

const DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.changeset');
const files = existsSync(DIR) ? readdirSync(DIR).filter(isChangesetFile).sort() : [];

let failed = 0;
for (const file of files) {
  const problems = lintChangeset(readFileSync(join(DIR, file), 'utf8'));
  if (problems.length === 0) continue;
  failed++;
  console.error(`.changeset/${file}`);
  for (const problem of problems) console.error(`    ${problem}`);
}

if (failed > 0) {
  console.error(`
[changesets] ${failed} of ${files.length} changeset(s) need fixing. Each one ends with a marker
naming its tags, for example:

    <!-- entry: fix -->
    <!-- entry: rank=5 new api -->

Tags: breaking, deprecates, api, new, behavior, data, visual, perf, fix, internal.
The rules: docs/releasing.md, "Writing a changeset".`);
  process.exit(1);
}
console.log(`[changesets] OK — ${files.length} changeset(s).`);
