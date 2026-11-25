Note path frame data dropped from Boolean result (A): fixed 6caf790f38

Background white test ignores `#ffffffff` (A): fixed 91faee4c14. The SVG export's own white test was folded into the same `isDefaultBackground`, along with the legacy-background load check. The export's regex also missed 4-digit `#ffff`.

CommandBar story registers a hand-picked subset of app actions (A): fixed b890b1f437

Swatch None toggle and Swap skip the selection (A+B): fixed fd43e856d2. Swap commits as one undo entry. The `/`, `X`, and `D` keys still change only the active paint. Their actions can't reach the selection edit, and the files are outside this area, so this is filed as a P3 in `docs/TODO.md` ("draw's color keys change only the next shape's paint…").

Second Alt-click on Hidden/Collapsed sets every row (B): fixed 1fd209b8f5. The existing test asserted the buggy result under the title "shows every piece"; it is corrected, and a Collapsed case is added.

`carriedData` keeps `pathEffect` (and `boolean`) on a plain path (B): fixed 1cb61b7992

Setting a swatch to None skips the selection (B): duplicate of the A+B swatch finding, fixed in fd43e856d2

No changesets: `apps/draw` is an unpublished app with no package manifest, and earlier draw fixes such as 0d532209b3 carry none. `check:changesets` passed inside the gate.

Checks:
- Every touched test file, run one at a time with `--maxWorkers=1`:
  - `drawPrefsDialog.test.tsx`: 8 passed
  - `booleansAdapter.test.ts`: 12 passed
  - `outlinesAdapter.test.ts`: 4 passed
  - `docBackground.test.ts`: 4 passed
  - `svgExport.test.ts`: 41 passed
  - `sceneLoading.test.ts`: 13 passed
  - `ActiveSwatches.test.tsx`: 7 passed
  - `ColorContextProvider.test.tsx`: 8 passed
  - `CommandBar.stories.test.tsx`: 1 passed
  - `CommandBar.test.tsx`: 8 passed
- `npm run checks:gate`: "checks:gate: all 32 passed" (the first run failed one typecheck error in a test cast, fixed in 6caf790f38). This includes root `npm run lint`. No `-w` package lint applies, since every change is in `apps/draw` and the root lint covers it.
- Tree is clean.

tally: 6 of 7 fixed, 0 extra fixed