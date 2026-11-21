- pathDistanceToPoint measures a negative-size RectPath as if the point were outside it (A): fixed cf3081f22c
- mergeRegion with `tolerance: 0` drops every piece and returns an empty path (A): fixed 7c611a1f57. I made the strict call: it now throws a `RangeError` for any tolerance that is not a positive finite number, matching `pathFaceArrangement`. This is recorded in `docs/unruled.md`.
- mergeRegion's closeContour leaves gaps wider than the weld mid-contour, so the output gains chords across the shape (B): fixed fd74788747
- snipPathAt removes two pieces when the probe's nearest point is exactly a crossing, and a closed subpath comes back in `removed` drawn twice (B): fixed ce9121ccd9
- roughenPath truncates its seed to an int32, so fractional seeds all roughen the same way (B): fixed 002d578a87. Seeds that are already int32 integers keep the offsets they had.

No extra defects found. The same patterns don't appear anywhere else in the area.

Checks:
- `npx vitest run --maxWorkers=1` for each touched test file:
  - packages/geom/src/paths/pathDistance.test.ts: pass (10)
  - packages/geom/src/paths/mergeRegion.test.ts: pass (12)
  - packages/geom/src/paths/snipPath.test.ts: pass (9)
  - packages/geom/src/paths/roughenPath.test.ts (new): pass (2)
- Related test files that call the changed functions, also run: pathOriginReaders.test.ts pass (22), cornerRestore.test.ts pass (10), text glyphGeometry.pbt.test.ts pass (4), text textToPath.syntheticBold.test.ts pass (12)
- `npm run checks:gate`: the first run failed (`2 of 32 failed`): geom typecheck flagged a TS2339 in roughenPath.test.ts, which I fixed. The rerun gave `checks:gate: all 32 passed`.
- `npm run lint -w @weasel-js/geom`: the package has no `lint` script, only `test` and `build`. Instead I ran eslint on the changed files (clean), `check:size` (pass), and `check:changesets` (OK).

tally: 5 of 5 fixed, 0 extra fixed