- Kept anchors whose handles an edit swaps in place get their handle origins swapped (A+B): fixed 2f00b78fc4
- Knead misses a long segment that passes under the brush between probe samples (A): fixed 9c37a1273a
- deleteAnchorsAt drops untouched lone-point subpaths, and refuses a deletion because of them (A+B): fixed ea54f61bef
- A corner on the first anchor of a subpath closed by an explicit `L` back to its start is never cut (A): fixed 1c453bdaaa. A spec on the coincident last anchor now applies there too.
- anchorsToPath numbers corner specs by model anchor, so a folded closing curve shifts every later spec (B): fixed dacc5859fb
- asPolygonPath stores a far-out rect as raw float32 world coords with no origin (B): fixed 7215d2285f
- outsideSide returns null for a contour drawn as one closed curve, so growRegion grows that hole the wrong way (B): fixed 33d4259960

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, each file on its own: anchorOrigins.test.ts pass (16), kneadPath.test.ts pass (6), anchorEdits.test.ts (new) pass (3), corners.test.ts pass (28), anchors.test.ts pass (27), builder.test.ts pass (11), contourSides.test.ts (new) pass (1). The related tests also pass: corners.survival, cornerShape, cornerRestore, cornerCarry, cornerOffset, joinAnchors, simplifyAnchors, growRegion, constraints/pathsEdit, and constraints/pathConstraints.
- Each new test was seen failing before its fix.
- `npm run check:changesets`: pass ("OK — 105 changeset(s)")
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/geom`: not run, because `@weasel-js/geom` has no `lint` script (npm printed "Missing script"). The root `npm run lint` passed inside the gate.
- The tree is clean apart from `.skulkr/`.

tally: 7 of 7 fixed, 0 extra fixed