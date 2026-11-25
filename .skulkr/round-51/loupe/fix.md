A captured source keeps serving a stale frame after its last release, and a sampler that never retains it gets a misleading "capture() not called" warning (A+B): fixed a35a8be75a. Release now drops the frame and the copy. A captured source read while nothing holds it answers `null` and warns once to `retain()` it. Recorded in `docs/unruled.md` as my call: `canvasPixelSource` does not retain the source itself, and the README now says whoever samples a captured source holds it while reading.

Capture at zero size leaves the old frame current (A): fixed 50ef37574b

Initial factor ignores minFactor/maxFactor (A): fixed cab09212f8

Initial factor unclamped (B): duplicate of A's initial-factor finding, fixed cab09212f8

Rejected async hover leaves the previous point's color (A): fixed 2e7cbc984a

Rejected async sample leaves the previous color (B): duplicate of A's rejected-hover finding, fixed 2e7cbc984a

Surface `gone()` only noticed on the next aim (A): fixed aafd5dbd99. The model now tears itself down on a landed frame and on `resample`, `pick`, `setFactor` and `setMode` too.

Captured source not retained, so the sampler answers `null` and warns wrongly (B): duplicate of A's stale-snapshot finding, fixed a35a8be75a

`canvasPixelSource` scales by the canvas's current size but reads an older snapshot of another size (B): fixed 3eb7074482

README casts an async sample to a string for the loupe surface (B): fixed 3aac23e7fe. Recorded in `docs/unruled.md` as my call: a loupe surface whose `sample` answers with a promise now throws a `TypeError` from aim, resample and pick. An async sampler drives only the eyedropper, and the README and eyedropper docs say so.

Extra:
- labkit's `drawSourceLens` sizes its region from `source.canvas` while drawing `source.frame()`, the same mistake as B's frame-size finding (sweep): fixed 06dd3b164f. It is labkit code, outside loupe, but it was a single line next to this work.

Checks:
- Each touched or affected test file run alone with `--maxWorkers=1`, all pass:
  - in `packages/loupe/src`: canvasSource.test, canvasSource.pbt.test, model.test, model.pbt.test, eyedropper.test, eyedropper.pbt.test, sampler.test, geometry.pbt.test, loupe.shrunk.test, actions.test, composite.pbt.test, geometry.test, pick.test, sampler.pbt.test
  - in `packages/labkit/src/loupe`: sourceLens.test, canvasLens.test, useLoupe.test, SourceLoupe.density.test, types.test, LoupeGestures.test
- `loupe.shrunk.test.ts` was updated for the initial-factor clamp, in the same commit.
- `npm run check:changesets`: pass (OK — 2545 changesets).
- `npm run checks:gate`: pass ("checks:gate: all 32 passed"). The first run failed only on labkit lint formatting in my two files; I formatted them, folded that into 06dd3b164f, and reran.
- `npm run lint -w @weasel-js/labkit`: pass.
- `npm run lint -w @weasel-js/loupe`: not applicable, the package has no `lint` script; the gate's root lint covers it.
- Browser tests not run here: `SourceLoupe.browser.test.tsx`, `TrialLoupe.browser.test.tsx`, `TrialLoupe.pointer.browser.test.tsx`.
- Tree clean.

tally: 10 of 10 fixed, 1 extra fixed