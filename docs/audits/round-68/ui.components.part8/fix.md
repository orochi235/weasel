ScaleBar empty `lengths` renders NaN (B): fixed b0b2651e51. This was my call: `scaleBar` and `ScaleBar` now throw a `RangeError` for an empty list, recorded in `docs/unruled.md`.
`timed` follows the last-placed span, not the latest end on the track (A): fixed 80cda497ab
SpanStrip seeks on right-click or middle-click (B): fixed d8f11becd4
A second pointer mid-drag resets where a cancel goes back to (B): fixed f8fdd74a38
Sequence grid caps each axis, not the cells, so 65,536 cells (B): fixed 84cebb4a83. This was my call: `cap` now bounds the cells, recorded in `docs/unruled.md`.
Swatch id `lead` or `empty` collides with a ring's lead or empty key (A+B): fixed 8e0938f6e2
Two swatches of one color with no `id` get duplicate React keys (B): fixed 8e0938f6e2. It shares one commit with the finding above because a single key helper fixes both.
ShortcutSheet search reads a free-standing or trailing `+` as the plus key (A): fixed bd94d04db2

No extra defects.

Checks:
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"). The first run failed on six changeset titles over 140 characters. I shortened them and folded the changes into their own commits, and the second run passed.
- `npm run lint -w @weasel-js/ui` and `npm run lint -w @weasel-js/quantity`: fail with "Lifecycle script `lint` failed". Neither package has a `lint` script, so there is nothing to run. The root `npm run lint` passed inside the gate.
- `npx eslint` on the 15 changed files: ESLint crashed ("Oops! Something went wrong!", "No files matching the pattern … were found"), so these files had no direct eslint run. The gate's root lint passed.
- Each touched test file, run alone with `--maxWorkers=1`, passed:
  - `packages/quantity/src/scaleBar.test.ts`: 8 passed
  - `ScaleBar.test.tsx`: 4 passed
  - `SpanStrip.test.tsx`: 21 passed
  - `Sequence.test.tsx`: 8 passed
  - `SwatchGrid.test.tsx`: 17 passed
  - `SwatchGrid.along.test.tsx`: 17 passed
  - `sheetRows.test.ts` (new): 2 passed
  - `ShortcutSheet.test.tsx`: 7 passed
- Each new test failed against the old code, except the ScaleBar throw test and the flat-grid duplicate-key test, which I didn't run against it.
- No browser test files touched. The tree is clean.

tally: 9 of 9 fixed, 0 extra fixed