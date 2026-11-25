# Audit round 51 — area `loupe` (blind reviewer)

## A sampler over a captured CanvasSource answers `null` forever unless something else retains the source, then warns that `capture()` is never called
- where: packages/loupe/src/sampler.ts:129 (canvasPixelSource); packages/loupe/src/canvasSource.ts:134-165 (capture, frame)
- scenario: a WebGL context without `preserveDrawingBuffer` → `createCanvasSource(gl)` (captured from the start) → `createSampler([canvasPixelSource(source, box)])` driving `createEyedropperModel`, exactly as the README's eyedropper example shows, with no pixel lens holding the source. `canvasPixelSource.pixel` never calls `source.retain()`, so `readers` stays 0 and every `capture()` returns before copying; `frame()` is `null`, every hover/pick answers `null`, and after 120 reads `frame()` logs "nothing has called capture() on its source" although the drawing code calls it every frame. Expected: a pixel source that reads a captured source holds it (or the sampler does) so captures copy, or the doc says the layer must be retained.
- evidence: read
- severity: medium

## canvasPixelSource scales by the canvas's current size but `pixel` reads a snapshot that may be another size
- where: packages/loupe/src/sampler.ts:134-137 (canvasPixelSource.pixel); packages/loupe/src/canvasSource.ts:168-173 (pixel)
- scenario: a captured source whose canvas is resized (DPR change, layout resize) after the last `capture()` and before the next. `canvasPixelSource` computes `kx = canvas.width / box.width` from the new backing size, while `source.pixel` reads `frame()` = the old snapshot, bounds-checked against the snapshot's own size (the comment at :172 acknowledges the size can differ). The device point is computed for the new size and read from the old image, so the eyedropper/readout reports the color of a different place (e.g. at 2× after going 1×→2×, a point at the box's middle reads the snapshot's bottom-right corner or off it → `null`). Expected: scale against the size of the frame actually read.
- evidence: read
- severity: low

## The initial factor ignores `minFactor`/`maxFactor`, so the model's factor can sit outside the bounds `setFactor` enforces
- where: packages/loupe/src/model.ts:97 (createLoupeModel)
- scenario: `createLoupeModel({ surface, minFactor: 10 })` (default factor 8), or a stored pref `factor: 64` with `maxFactor: 16`. `factor` starts at `normalizeZoom(opts.factor ?? 8)` = 8 / 64, outside [min, max]; the first `setFactor(model.factor)` then jumps it to the bound. The same option is answered two ways: clamped on `setFactor`, unclamped at construction. Expected: the initial factor goes through the same `clamp`.
- evidence: read
- severity: low

## Eyedropper: a rejected async sample leaves `color` at the previous point's color
- where: packages/loupe/src/eyedropper.ts:70-72 (hover)
- scenario: an async sampler (WebGPU readback) answers point A, then the readback for hover B rejects (device lost, canceled readback). The rejection is swallowed with `() => undefined`, so `color` and the last `onColorChange` stay A's color while the pointer is over B. The doc at :47-48 promises "`color` is always the latest point's". Expected: a failed latest hover settles `null` (the surface cannot say), as the loupe surface's contract does for "cannot say".
- evidence: read
- severity: low

## README's eyedropper example casts an async sample to a string and feeds it to the loupe surface
- where: packages/loupe/README.md:46-48 (example for createSampler / createEyedropperModel); contract in packages/loupe/src/model.ts:29 (LoupeSurface.sample)
- scenario: the example builds `surface.sample` as `sampler.sample(p) as string | null`. The same section says a source "can answer later (a WebGPU readback); the sampler then answers with a promise". With such a source, `createLoupeModel`'s `sampleColor` stores the Promise as `color`, compares it by identity (every aim is "changed"), passes a Promise to `onColorChange`, and `pick()` passes a Promise to `onPick`. `LoupeSurface.sample` is synchronous only, so the documented "give the loupe's surface the same sampler" (eyedropper.ts:14-15) does not work for the async case the README advertises; the cast hides that. Expected: the surface accepts `MaybePromise`, or the example/doc restricts it to synchronous samplers.
- evidence: read
- severity: low

## Files read
packages/loupe/src/actionParamSchema.ts
packages/loupe/src/actions.ts
packages/loupe/src/canvasSource.ts
packages/loupe/src/eyedropper.ts
packages/loupe/src/geometry.ts
packages/loupe/src/index.ts
packages/loupe/src/model.ts
packages/loupe/src/pbt.fixture.ts
packages/loupe/src/sampler.ts

<!-- done: 5 findings, files read: 9 -->
