Geometry probe ignores the parallax plane's scale (A+B): fixed 9b44cee326

Turned resize far from the origin drops the sides it moves (A): not a defect (does not reproduce: at 90°, 180° and 270°, offsets 1e3 to 1e9, edge and corner handles, the tied corners round to identical values, so their rates match exactly)

`SpanSnap.anchor` leaves `startHeld()` reporting the replaced start's hold (A): fixed 1632e9033a

`hold` doesn't keep the angle at `theta0` when another required angle is offered (B): fixed 13aa5f23e6

A rotate's step is checked differently from a point gesture's (B): fixed 5482055763

Debug overlay draws a spanned candidate off its span (B): fixed 6f6781e2d2

[r42-1] pointSnap's trail always snaps with no modifiers held (carried): question (the pointer dep the pen and spiro trails follow carries no modifiers, and the trail is not re-read when one changes; fixing it needs the canvas's `useHeldModifiers` routed into a tool's deps, which is beyond this area; filed as a P3 in `docs/TODO.md`, 0d5d9f607a)

[r42-2] `SnapCollect.include` is documented but no session sets it (carried): fixed 9b2d07ef26 (strict call: removed rather than wired, since only `pathSnapSource` read it and making it real would have every source honor it; recorded in `docs/unruled.md`, with a `major` breaking changeset)

[r42-3] createSnapSession2d can't express `along`, per-gesture `sources` or `omit` (carried): fixed acb87806cf (adds `along` and `omit`; a caller of the factory already passes its own `sources` list per gesture)

[r42-4] The test `sessionDep` ignores a request's `sources` and `omit` (carried): fixed 84b24f0567 (it and the canvas dep now both build the list through `sourcesForRequest`)

[r42-5] Debug overlay places a segment or bounded-face candidate on its unbounded flat (carried): duplicate of "Debug overlay draws a spanned candidate off its span" (6f6781e2d2)

[r42-6] A group's move never finds its own geometry (carried): fixed d184020a9d

[r42-7] `SpanSnap.anchor` leaves `startHeld()` reporting the old snap (carried): duplicate of "`SpanSnap.anchor` leaves `startHeld()` …" (1632e9033a)

Extra: none.

Checks:
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed `check:changesets` on three changeset titles over 140 characters; I shortened them and folded the fixes into their commits.
- `npm run lint -w @weasel-js/core`, `-w @weasel-js/geom`, `-w @weasel-js/measure`: not run. Those packages have no `lint` script ("Missing script: "lint""). I ran eslint on every changed `.ts` file instead: pass (exit 0).
- `npx vitest run --maxWorkers=1`, one file at a time, all pass:
  - `pathSnapSource.test.ts`: 20 passed
  - `angle2d.test.ts`: 10 passed
  - `debugCandidates.test.ts`: 1 passed
  - `sceneSession2d.test.ts`: 10 passed
  - `spanSnap.test.ts`: 4 passed
  - `testing/sessionDep.test.ts`: 1 passed
  - `geom/src/snap/flat.test.ts`: 16 passed
- `packages/measure/src`, `canvas/deps/snap.test.tsx` and `domains/snap` together: 171 passed. No browser test files were touched.

tally: 10 of 14 fixed, 0 extra fixed