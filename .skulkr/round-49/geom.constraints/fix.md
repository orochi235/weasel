- Holding an `onPath` anchor on the wrong curve after an edit reverses its subpath (A): fixed 0cb81d240b. Where both segment anchors' origins are marked `reversed`, the pair is turned round, then put in the order `segmentBetween` gives. Still broken: a reversed two-anchor closed subpath (a lens). `editAnchorSetTracked`'s `runsBackward` never marks a lens as reversed, because walking either way visits the same neighbors. That is in `paths/anchorOrigins` (area geom.paths), outside this one, so I didn't fix it.
- `segmentBetween` can't answer a lens's closing segment (A): fixed 2bd5954aa1.
- An item's own constraint naming an anchor past its path binds another item's anchor in `constrainPathsEdit` (A+B): fixed 98990484e7. Such a constraint is now dropped, as `constrainPathEdit` already drops it.
- A zero-length segment gives `length`/`equalLength` no gradient, so the solve can't open it (A): fixed ba7bffd69f.
- `anchorsBefore` takes an anchor added past an open subpath's end for its neighbor, so the end anchor's constraints move onto it (B): fixed 4d08719d1e. `PointOrigin` gains `made?: true`, set on every point of an anchor the edit made. That change has its own `minor` changeset (`geom-point-origin-made.md`) besides the fix's `patch` one.
- Extra defect, not fixed: the lens case under the first line. It needs a handle-based reversal test in `runsBackward`, in another area's file.

Checks:
- `npx vitest run --maxWorkers=1 packages/geom/src/constraints/pathConstraints.test.ts`: pass (17)
- `npx vitest run --maxWorkers=1 packages/geom/src/constraints/pathsEdit.test.ts`: pass (5)
- `npx vitest run --maxWorkers=1 packages/geom/src/constraints/solve.test.ts`: pass (26)
- `npx vitest run --maxWorkers=1 packages/geom/src/paths/anchorOrigins.test.ts`: pass (15)
- Other users of origins, `pathStructure.test.ts`, core `anchorData.test.ts`, path-tools `anchorEdits.vertexWidths.test.tsx` and `anchorFields.test.tsx`: pass
- `npm run check:changesets`: pass
- `npm run checks:gate`: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/geom`: n/a, geom has no `lint` script. `npx eslint` on the changed files: pass, no output
- Tree clean

tally: 5 of 5 fixed, 0 extra fixed