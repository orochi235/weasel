[r42-1] pathNode drops a `place.pose`'s `transform` (carried): not a defect (no longer applies). `pathNode` copies `pose.transform`, fixed in be3711cc9a, and `pathNode.test.ts` covers a skewed pose.

[r42-2] anchorIndexUnder measures its reach as a world circle, so a view that scales its axes apart reaches too far on one axis (carried): fixed bba0d6e615. It now measures distance on screen through `scaleDelta`.

[r42-3] the path-edit overlay draws anchors at the stored pose, not the drawn one (carried): fixed 4639954c79. The overlay, anchor picking and `getEditablePath` now read the node's drawn pose (`effectivePose`) through a new `drawnNodeOf` helper. `shownNodeOf` takes a `PoseReading`. Commits (`reshapeOps`, `editOps`, `finishEdit`, extensions' `finishCtx`/`before`) and path-tools' `brokenConstraintLink` read `'document'`, so a gesture's own override is not taken for the state it started from. Fake scenes in core and path-tools tests gained `overrides`.

[r42-4] the path-snap index snaps to each node's stored pose, not its drawn one (carried): fixed 88ffcf60b8. The index places each node at its drawn pose and keys its cache on `scene.overrides.getGeneration()`, so it rebuilds when an override moves.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: pass. That covers `anchorUnder.test.ts` (2), `nodeFrame.test.ts` (8), `pathSnapSource.test.ts` (20), `editAnchors.test.tsx` (9), `shapeGenerator.test.tsx` (2) and `textSnap.test.ts` (1).
- Before the fixes: the anchor test and three of the new `nodeFrame` tests failed.
- Wider runs: core `domains`/`interactions`/`canvas` pass (401 files, 2910 tests); path-tools `npm test` pass (135 files, 805 tests); editing `npm test` pass (353 files, before the last change); diagram, symmetry, editing move-snap and measure snap tests pass.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run lint -w` for core, path-tools and text-tools: fail with `Missing script: "lint"`. None of the three has a lint script, so I ran eslint on every changed file instead: exit 0.
- `npm run typecheck:packages -- core path-tools text-tools`: all ok.
- Tree clean.

tally: 3 of 4 fixed, 0 extra fixed