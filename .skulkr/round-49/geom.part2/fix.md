- poseFrameInverseOf / pathThroughPoseFrame throw on a null or undefined pose (A+B): fixed 53b1f5a0e1
- stepLine with a zero or non-finite step answers a NaN direction (A): fixed a08f9a2001. I made the strict call: `stepLine` now throws a `RangeError` for such a step. It is recorded in `docs/unruled.md`, and the `SnapConstrain` doc in core says so.
- tagTypedArrays and typedArrayReplacer disagree on class instances (A+B): fixed b165f5f7f6. The finding was partly wrong. A plain class instance already tags as `[object Object]`, so `isPlain` was true for it and it was handled. The same disagreement was real for an object with `toJSON` and for an instance with its own `Symbol.toStringTag`. `tagTypedArrays` now copies an object the way `JSON.stringify` writes it, for both cases.
- trackRun.nearest clamps the whole shape's nearest point into the run (A+B): fixed f9ff7643fd. The run and `trackSlice` now share `nearestInStretch`.
- Quadrant snap points are centered on the control-point box (A+B): fixed 74e9ba638f
- polygonIntersectsPath with `filled: false` counts an open subpath's closing chord (A+B): fixed 4bfe23b244
- rotatePathAbout writes far-out coords into float32 with no origin (A+B): fixed 61a9d6ea07
- ringSignedArea loses its sign far from the origin (B): fixed d5879b2622. `booleans/adapter.ts` has a private copy with the same mistake. It is outside this area and I had no failing test for it, so I left it alone.
- shiftTrack carries a closed shape past its seam at the end's ratio (B): fixed d757a215ef
- The paths guide says `dist` and `tolerance` where the code has `distance` and `flattenTolerance` (B): fixed eb324baff6
- ellipseShape with `start: 0, end: 360` is zero-length or not quite closed (B): fixed f5901e2c7d
- The pbt fixture `coord` draws `-0` (B): fixed 93e6891eeb

Extra: none. c293837884 only shortens this pass's changeset titles, which `check:changesets` refused at over 140 characters.

Checks:
- Every touched test file, one at a time with `--maxWorkers=1`: pass. That covers typedArrayJson.classes, poseRotation, poseFrame, stepLine, run, pathHitTest, pathSnap, polyline, shift, ellipse, nearest.guide and pbt.fixture. Each new test failed before its fix.
- Every pbt file that imports the fixture, plus slice, place and the other pathHitTest files: pass.
- `npm run checks:gate`: the first run failed only `check:changesets` (titles too long). After the fix: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/geom` and `-w @weasel-js/core`: fail with `Missing script: "lint"`. Neither package has a lint script. eslint on every changed `.ts` file: pass. The root `npm run lint` passed inside the gate.
- No browser tests touched. The tree is clean apart from `.skulk/`.

tally: 18 of 18 fixed, 0 extra fixed