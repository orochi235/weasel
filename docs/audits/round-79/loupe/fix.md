A NaN factor no longer lands below `minFactor` (A+B): fixed a7cc0090aa

`onDispose` runs on an explicit `dispose()` despite its doc (A): fixed 14c93898d9. The doc was wrong, not the code: the hud's loupe relies on `onDispose` to release its pixels when it calls `model.dispose()`.

A surface with `worldAt` but no `pointFor` mixes content and surface points (A): fixed 9d232c8f9a. This was a strict call: `createLoupeModel` now throws a `TypeError` on a surface with only one of the two, recorded in `docs/unruled.md`.

A promise refused by `sampleNow` was left unhandled (A): fixed 768c022915

The missed-capture warning counted every `frame()` call, not lens frames (A): fixed 6abc4017be. It now warns after two seconds of reads with no capture, and the wait starts over on a capture or a first `retain()`.

A failed probe context made a new 1×1 canvas on every `pixel()` (A): fixed 26b7122650

`nearestStopIndex([])` answered index 0 (A): fixed c2619a93e1. This was a strict call: it throws a `RangeError`, recorded in `docs/unruled.md`. The hud's zoom track stays hidden with fewer than two stops, so it never reaches the throw.

The `near` helper's doc named an `abs` tolerance it does not take (A): fixed d8fb8f4418

`holdPin` samples and redraws a hidden lens (B): not a defect. `holdPin` is documented as ignored only once the model is disposed, so restoring a saved pin while hidden is intended. The color under the new aim is a true reading; skipping it would leave `color` stale for the pin.

`CanvasSource.pixel` throws on a tainted canvas (B): fixed d09df107a5. It now answers `null` and warns once; errors other than `SecurityError` are still thrown. As part of this fix the pixel read moved into its own `createProbe` helper, so `createCanvasSource` stays under the 120-line function cap.

Extra: the example in `nearestStopIndex`'s doc was wrong (sweep). It said "6× is as near 4× as 8×", but measured in doublings 6× is nearer 8×. Fixed in c2619a93e1.

Checks:
- `npx vitest run --maxWorkers=1`, one at a time:
  - `model.test.ts`: pass (34)
  - `model.pin.test.ts`: pass (9)
  - `canvasSource.test.ts`: pass (20)
  - `canvasSource.pbt.test.ts`: pass (1). Its model now steps a clock instead of counting reads.
  - `model.pbt.test.ts`: pass (1). Its model now normalizes before clamping.
  - `zoomStops.test.ts`: pass (2). This file is new.
- `npm run checks:gate`: pass, "all 33 passed". The first run failed `check:size` on `createCanvasSource` (131 lines); the `createProbe` split fixed it.
- `npm run check:changesets`: pass ("OK").
- `npm run lint -w @weasel-js/loupe`: not run, because the package has no lint script. `npx eslint packages/loupe/src` passed clean.
- No browser tests were touched. The tree is clean.

tally: 10 of 11 fixed, 1 extra fixed