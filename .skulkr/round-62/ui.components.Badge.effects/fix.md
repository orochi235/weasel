[r56-1] stroke widths given in CSS px come out too thick (carried): fixed 4a61898e4a
[r56-2] the aqua and metal gloss ends at glossExtent²/100 (carried): fixed 1466af14a6
[r56-3] perforations hangs when the radius and spacing are both 0 (carried): fixed 83a48e4c29. My call: holes sit at least 1 CSS px apart and a negative `holeRadius` reads as 0, matching the `perforated` shape. Recorded in `docs/unruled.md`.
[r56-4] bevel leaves gaps at the seams between its bands (carried): fixed f2beda52f8. Bevel and Bevel2 now draw their bands through one shared helper, `effects/bevelBands.ts`.
[r56-5] bites and scallops get cut off at the midpoint between bumps (carried): fixed c92d029c85. The radius is held to half the spacing in one shared `bumpRadius` in `bumps.ts`. Puffs already spans its whole spacing and goes to 0 at both ends, so it did not have the bug.
[r56-6] spikes does not clamp irregularity (carried): fixed 2f415cf6b8
[r56-7] the sunbeams gradient axis stops short of the corners at diagonal angles (carried): fixed b85b7b100c
[r56-8] bevel insets along the viewBox normal instead of the CSS normal (carried): not a defect. `PerimeterPoint.nx/ny` is the CSS-space normal: `polygonSampler` builds it from CSS-px edges, and RoundedRect's ellipse and pinch normals are worked out in CSS space too. Scaling `n·w` by `sx` and `sy` is the correct CSS inset.
[r56-9] the outline effect scales a non-scaling stroke a second time (carried): duplicate of [r56-1], fixed in 4a61898e4a
[r56-10] the aqua and metal bezel and rim are scaled twice (carried): duplicate of [r56-1], fixed in 4a61898e4a
[r56-13] spikes leaves irregularity unclamped (carried): duplicate of [r56-6], fixed in 2f415cf6b8

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/effects/effectGeometry.test.tsx`: pass (11 passed)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/effects/effectHookOrder.test.tsx`: pass (6 passed)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/effects/bumps.test.ts`: pass (8 passed)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/effects/effectColors.test.tsx`: pass (2 passed)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/ui`: did not run ("Missing script: \"lint\""). `npx eslint packages/ui/src/components/Badge/effects/` ran in its place and passed (exit 0).
- `npm run typecheck:packages -- ui`: pass ("1/1 ui ok")
- Before the fixes, the new tests failed 8 of 9. The perforations test was left out of that run because the old code hangs on it: `Math.round(total / 0)` is `Infinity`, so the hole loop never ends.

tally: 10 of 11 fixed, 0 extra fixed