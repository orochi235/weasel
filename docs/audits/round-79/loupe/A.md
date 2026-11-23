# Audit round 79 — loupe (blind reviewer)

## A NaN factor escapes `minFactor`: the model clamps before it normalizes
- where: packages/loupe/src/model.ts:150 (createLoupeModel `clamp`)
- scenario: `createLoupeModel({ surface, minFactor: 1 })`, then `setFactor(NaN)` (or `factor: NaN`). `clampTo(NaN, 1, ∞)` returns NaN, since both comparisons are false, and `normalizeZoom(NaN)` then gives `ZOOM_FLOOR`, which is below `minFactor`. The factor should stay inside `[minFactor, maxFactor]`; normalizing first and clamping after would keep it there.
- evidence: read (clamp in geom/src/scalar.ts:25, normalizeZoom in geom/src/view.ts:32)
- severity: low

## `onDispose` fires on an explicit `dispose()` too, though the docs limit it to the surface reporting the lens gone
- where: packages/loupe/src/model.ts:171 (teardown), :250 (`dispose: teardown`)
- scenario: a painter calls `model.dispose()` while tearing down and also releases its resources in `onDispose`, which the docs say runs only "because the surface reported the lens gone". `teardown` runs `onDispose` on both paths, so the painter's release code runs again inside its own teardown. Either the doc or the code is wrong.
- evidence: read
- severity: low

## A surface with `worldAt` but no `pointFor` reports its pin's content-space point as a surface point
- where: packages/loupe/src/aim.ts:27 (createLoupeAim `now`)
- scenario: the surface implements only `worldAt`, for example a world point under a zoomed camera. `pin(p)` stores `worldAt(p)`, and `now()` falls back to `pinned` itself because `pointFor` is missing. So `model.aim`, the color sample and `pick()` all read a world coordinate as if it were in surface CSS px, and the lens jumps to an unrelated place. The two optional members are only useful together; with just one of them the aim should treat both as absent rather than mix the two spaces.
- evidence: read
- severity: low

## `sampleNow` throws on a promise but leaves that promise unhandled
- where: packages/loupe/src/model.ts:130 (sampleNow)
- scenario: a surface's `sample` returns a promise that rejects, such as a failed async readback. The model throws its TypeError (as unruled.md:537 rules), but nothing attaches a handler to the promise it dropped, so the rejection also shows up as an unhandled rejection, a second error unrelated to the one thrown.
- evidence: read
- severity: low

## The missed-capture warning counts every `frame()` call, not every lens frame
- where: packages/loupe/src/canvasSource.ts:189 (frame), with sampler.ts:136 (canvasPixelSource)
- scenario: a captured source with readers and no capture yet is read by an eyedropper's `canvasPixelSource` on each pointer move, and by the lens on each frame. Every call adds to `missed`, so the "nothing has called capture()" warning fires after 120 reads of any kind. That can be a fraction of a second of hovering, not the "about two seconds of lens frames" the constant is described as. The warning can fire during the normal gap before a draw-on-demand canvas's first capture.
- evidence: read
- severity: low

## A failed probe context makes `pixel()` build a new 1×1 canvas on every call
- where: packages/loupe/src/canvasSource.ts:213 (pixel)
- scenario: when `context2d(makeCanvas(1, 1), true)` returns null (context limit, or a stub environment), `probe` stays null and the function returns null. The next call makes and discards another canvas, so every sample allocates a canvas. It should remember the failure, or keep the canvas.
- evidence: read
- severity: low

## `nearestStopIndex` answers index 0 for an empty stop list
- where: packages/loupe/src/zoomStops.ts:12 (nearestStopIndex)
- scenario: `nearestStopIndex([], 4)` returns 0, an index that does not exist. A caller doing `stops[nearestStopIndex(stops, f)]` gets `undefined` as a factor, and `setFactor(undefined)` turns it into `ZOOM_FLOOR`. It should return -1, or the docs should require a non-empty list.
- evidence: read
- severity: low

## The `near` test helper's doc names an `abs` tolerance it does not take
- where: packages/loupe/src/pbt.fixture.ts:58 (near)
- scenario: the doc says "within `rel` of the larger magnitude involved, or `abs`", but the function has no `abs` parameter. A property test written from the doc that passes an absolute tolerance as the 4th argument actually sets `rel`, which loosens the check by orders of magnitude without any error.
- evidence: read
- severity: low

## Files read
packages/loupe/src/actionParamSchema.ts
packages/loupe/src/actions.ts
packages/loupe/src/aim.ts
packages/loupe/src/canvasSource.ts
packages/loupe/src/eyedropper.ts
packages/loupe/src/geometry.ts
packages/loupe/src/index.ts
packages/loupe/src/model.ts
packages/loupe/src/pbt.fixture.ts
packages/loupe/src/sampler.ts
packages/loupe/src/zoomStops.ts

<!-- done: 8 findings, files read: 11 -->
