- unscoped grid reads tagged lengths with the unit's affine offset (A+B): fixed 63b8704bd5
- `bounds` makes the layer draw every line across the bounds, not just what is visible (A): fixed a73370a318
- grid lines and region clips are absolute float32 world coordinates, so they drift far from zero (A+B): fixed c07588f1b8
- `useGridCellHover` keeps a stale cell when the view, spacing or regions change without a pointer move (A): fixed 4f10c115fd
- `sceneGridRegions` builds its child lists in quadratic time (A): fixed ff871e7483. There is no failing test for this one: it is a cost fix and timing would be the only way to show it. The existing `sceneGridRegions` tests pass.
- a NaN or infinite `offset` passes validation and `cellOf` returns a cell of NaNs (B): fixed d10da9c6fe
- `useGridCellHover` binds `ref.current` once, so an element attached later or swapped by a remount gets no listeners (B, and the second half of A's hover finding): fixed 4f10c115fd. This is the same commit as the stale-cell fix, with its own changeset. The listeners now follow `ref.current` after each render of the hook's component. An element that mounts without that component re-rendering still can't be seen through a `RefObject`, and the hook's doc now says so.

Extra defects: none. Clipping `bounds` to the viewport meant updating two `layer.scopes.test.ts` tests, which assumed offscreen regions still drew; they now use a larger canvas. The origin change meant the layer tests read coordinates through a `worldCoords` helper. Nothing was recorded in `docs/unruled.md`: no finding needed a behavior call.

Checks:
- `npx vitest run --maxWorkers=1` on `reading.test.ts`, `axes.test.ts`, `useGridCellHover.test.ts`, `layer.test.ts`, `layer.scopes.test.ts`, `layer.axes.test.ts`: pass (2, 15, 14, 24, 13 and 6 tests). `preset`, `cellHighlight`, `grid`, `edges.pbt` and `edges.shrunk` also pass. No browser tests were touched.
- `npm run checks:gate`: 31 of 32 passed; `check:changesets` failed (five titles over 140 characters). I shortened the titles and folded the fixes into their commits; `npm run check:changesets` then passed: "OK — 2397 changeset(s)". The rest of the gate was not rerun, because the rebase changed only changeset files.
- `npm run lint -w @weasel-js/guides`: fails because the package has no `lint` script. `npx eslint packages/guides/src/grid` passes (exit 0).
- `npm run check:size`: pass.
- The tree is clean and `.skulk/` was not touched.

tally: 7 of 9 fixed, 0 extra fixed