`samples` unbounded, and `NaN` throws, on the spline bases, plus `arcSamples` unbounded on the puzzle base (A+B): fixed d991e9100a. Spline `samples` is held to 48..1024 and `arcSamples` to 6..256; `NaN` reads as the least. `MAX_SAMPLES` moved into `polygonSampler.ts`. Recorded in `docs/unruled.md`.

A spline base's `count: NaN` or `count: undefined` throws (A): fixed ca49b31741. `NaN` now reads as the least (3 anchors), per round 57's ruling on counts. The `undefined` case is fixed by 28b4c1cfbc.

octant-spline anchors that share an `s` blow the curve up (A+B): fixed ed6b3fec1d. Anchors within 1e-6 of one `s` become one point. At s = 0 the first of them is kept, elsewhere the last, so the end anchor that quadrant mode pins survives. octant-bspline keeps them all. This was my call, recorded in `docs/unruled.md`.

octant-bspline steps at each cardinal in quadrant mode (A+B): fixed 352091917e. The knot vector is now uniform, and in quadrant mode the phantom points wrap from the far end, so the curve repeats with period 1. `octantBSplineRadius` takes an optional `mode` (a minor changeset), and ui-lab's spline editor passes it. Every octant-bspline outline changes slightly, and the test's pinned B-spline values were regenerated.

octant-bspline has a corner at s = 0 and s = 1 in octant mode (B): fixed 352091917e, the same change. The uniform knots make the mirrored phantom points exactly symmetric; a test checks that r(−e) = r(e) and r(1+e) = r(1−e).

A param set to `undefined` replaces the default, giving `NaN` geometry, a ribbon end that throws, and a puzzle edge drawn as a socket (A+B): fixed 28b4c1cfbc. Every base and `resolveCompose` now merge through `withDefaults`. An end or edge name a base doesn't know now throws a `RangeError` naming it; that was my call, recorded in `docs/unruled.md`.

A `NaN` base param draws `NaN` geometry (A): fixed e2bedcddb8. Bounded params go through `clampParam`; `rotation` and powerline `depth`, which have no bounds, go through a new `finiteOr`, so an infinite value also reads as the default. Recorded in `docs/unruled.md`.

Puzzle sockets cross each other within the allowed `tabSize` (A+B): fixed 980e515dc7. `tabSize` now stops where two sockets would touch: about 30.9 with two opposite sockets and 24.6 with two adjacent ones. A test checks every combination of edges at 40 and finds no crossing outline. This was my call, recorded in `docs/unruled.md`.

A pinched rounded-rect reports the unpinched `totalCss` and walks by unpinched arc length (A+B): fixed 037f5df7a3. It now measures the squeezed outline itself and walks it by that length. A's sub-point about square corners being cut is fixed in the same commit: the drawn path now has a vertex at every corner.

Extra, found while fixing (sweep): ui-lab's spline editor drew quadrant-mode B-spline previews without the mode, so they didn't match the badge. Fixed in 352091917e.

Checks:
- Each touched test file run alone with `--maxWorkers=1`: `baseParams`, `sampleCounts`, `octantSplines`, `Quatrefoil`, `rectBases`, `Puzzle` and ui-lab's `splineAnchors`, all pass. Each new test was also run against the old code and failed there.
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/ apps/ui-lab/src/badge/`: Test Files 39 passed (39), Tests 631 passed (631). Some of these may be browser tests.
- `npm run typecheck:packages -- ui`: 1/1 ui ok.
- `npm run check:changesets`: OK — 3098 changeset(s).
- `npm run checks:gate`: all 32 passed. That includes the root `npm run lint`, which also covers ui-lab.
- `npm run lint -w @weasel-js/ui`: not run. `@weasel-js/ui` has no `lint` script, and ui-lab has no `package.json` of its own.
- Tree clean; 8 commits on top of 8c21b13885.

tally: 9 of 9 fixed, 1 extra fixed