GPOS kerning reading unbounded over shared lists (A): fixed f0e105adc3. A Feature, Script or LangSys table that many records point to is now read once. Once the indexes read pass four per byte of the font, `gposPairKerning` gives up and returns `null`, so the face falls back to its legacy `kern` table. It returns `null` rather than refusing the face because the existing property test requires that a damaged GPOS never throws. This is my own call, recorded in `docs/unruled.md`.

WOFF table length limited only by its own declared `origLength` (A): fixed d7511c1a2c. A WOFF file is now refused when a table claims more than 1032 times its compressed length, which is the most deflate can expand. Each table now inflates directly into the output buffer, so it is held in memory once instead of three times. Recorded in `docs/unruled.md`.

WOFF repeated tags and tables sharing stored bytes, with no cap on total size (B): fixed dae3211402. The same checks `.ttc` already applies: a WOFF file that lists a table twice or has two tables sharing stored bytes is refused. Together with the 1032× limit, total output can be at most 1032 times the file's size. This also covers B's point about no cap on total output. Commit 45be6e1ace only shortens two of the changeset titles.

Checks:
- `npx vitest run --maxWorkers=1 packages/font/src/outline/woff.test.ts`: pass (10 passed)
- `npx vitest run --maxWorkers=1 packages/font/src/outline/gposKerning.test.ts`: pass (10 passed)
- `npx vitest run --maxWorkers=1 packages/font/src/outline/gposKerning.pbt.test.ts`: pass (4 passed)
- also run: opentypeParser.test.ts, opentypeParser.pbt.test.ts and opentypeAdvance.test.ts (not edited): pass
- `npm run checks:gate`: pass (exit 0)
- `npm run lint -w @weasel-js/font`: unrun, because the package has no lint script. I ran eslint on the four changed files instead: pass
- `npm run check:changesets`: pass, with no warnings on the new changesets

tally: 3 of 3 fixed, 0 extra fixed