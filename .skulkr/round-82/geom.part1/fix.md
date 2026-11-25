pathCrossings reported one crossing twice where a stroke passed through a vertex (A): fixed 1ade325a94. A crossing at a joint is now reported once, whichever segments find it, and a path's own joints are skipped the same way. The `adjacentSegments` helper had no other users after this and was removed.

The arc-length flatteners measured the first piece from wherever `out` ended, not from the segment start (A): fixed 14655c09d2.

transformAabb gave a finite, wrong box when a projective `m` put the box partly behind the eye (A): fixed 9a55a3db8a. It now answers an infinite box when the corners' `w` don't all share a sign or one is 0.

segmentCrossings missed every touch and overlap between a straight curve and a collinear line or another straight curve (B): fixed 0d3240df2e. A flat piece with parallel chords now takes the ends of the stretch the chords share, mapped back to each curve's parameter. If there is no shared stretch it uses the chord crossing as before.

A LengthRun with more than two control points, or controls that aren't whole points, was silently mis-measured (B): fixed f9d7fecd56. This needed a behavior call, so I made the strict one: `lengthTable` throws a `RangeError`. It's recorded in `docs/unruled.md` and stated on the `LengthRun.controls` doc.

Checks:
- Every new test failed before its fix and passes after.
- `packages/geom/src/flatten.test.ts`: pass (28)
- `packages/geom/src/3d/3d.test.ts`: pass (50)
- `packages/geom/src/along/lengthTable.test.ts`: pass (22)
- `packages/geom/src/intersect/intersect.test.ts`: pass (20)
- Related tests that call the crossing code:
  - `packages/geom/src/curve.pbt.test.ts`: pass (13)
  - `packages/geom/src/booleans/curveBoolean.test.ts`: pass (47)
  - `packages/geom/src/booleans/curvePieces.test.ts`: pass (14)
  - `packages/geom/src/booleans/pathFaceArrangement.test.ts`: pass (12)
  - `packages/geom/src/booleans/pathOps.test.ts`: pass (25)
  - `packages/geom/src/booleans/snipAtCrossings.test.ts`: pass (5)
  - `packages/geom/src/booleans/ops.laws.pbt.test.ts`: pass (6)
  - `packages/geom/src/paths/reachPath.test.ts`: pass (16)
  - `packages/geom/src/paths/snipPath.test.ts`: pass (9)
  - `packages/geom/src/snap/pathSnap.test.ts`: pass (15)
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/geom`: not run. The package has no `lint` script ("npm error … Did you mean this?"). In its place:
  - `npx eslint` on the changed `.ts` files: pass
  - the root `npm run lint` inside the gate: pass
- `npm run check:changesets`: pass ("OK — 1147 changeset(s)")
- `npm run check:size`: pass
- Tree is clean.

tally: 5 of 5 fixed, 0 extra fixed