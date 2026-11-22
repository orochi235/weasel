`mergeRegion` throws on a short, slightly tilted edge along a long one (A): fixed e0a9ced552

`pathFromD` keeps drawing after numbers that follow `Z` (A): fixed b65c5de314

`simplifyAnchorsAt` empties a closed one-anchor subpath (A): fixed a97aed5caf

`simplifyPath` drops lone-anchor subpaths (A): fixed 4fe8e57b15

`roughenPath` gives two contours the same offsets past 65,536 samples on a contour (A): fixed c9d140929f

Marker builders lose their shape far from 0 because they write float32 coordinates with no origin (B): fixed 2d70796af3 (changeset title shortened in d57c477708)

`reachToMeet` with `maxDistance: Infinity` meets nothing in tangent and eased modes (B): fixed dff00a4908

`pathSignedArea` returns a negative area for a negative-extent `RectPath` (B): fixed 4234433337. The doc was wrong, not the code. `growRegion` and `mergeRegion` rely on the sign matching the direction the rect is walked, so I corrected the doc and added a test that pins the sign, and left the code alone.

Extra, found while fixing (sweep): `simplifySubpath` threw a `TypeError` on a closed subpath whose anchors all sit on one point when `cornerAngle` is above 90°, because no corner is found and the closed branch reads a second sample that isn't there. Fixed in a97aed5caf, with a test in `simplifyPath.test.ts`, which landed in commit 4fe8e57b15.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `mergeRegion.test.ts` pass, `pathFromD.errors.test.ts` pass, `pathFromD.test.ts` pass, `simplifyPath.test.ts` pass, `simplifyAnchors.test.ts` pass, `simplifyAnchors.property.test.ts` pass, `roughenPath.test.ts` pass, `markers.test.ts` pass, `reachPath.test.ts` pass, `winding.test.ts` pass.
- Callers of the changed code, run the same way: `effectSources.test.ts` pass, `shapeEffects.test.ts` pass, `pathOriginReaders.test.ts` pass, `distortPaths.test.ts` pass, `apps/draw/src/pathEffects.test.ts` pass, `anchorMarkers.test.ts` pass, `brushOverlay.test.ts` pass, `spiroMarkers.test.ts` pass.
- `npm run checks:gate`: 32 of 33 pass, `check:changesets` fail (the marker changeset's title ran 174 characters). After shortening it, `npm run check:changesets` pass (`OK — 143 changeset(s)`). I did not rerun the whole gate.
- `npm run lint -w @weasel-js/geom`: fail, because geom has no `lint` script. The root `npm run lint` inside the gate passed.

tally: 8 of 8 fixed, 1 extra fixed