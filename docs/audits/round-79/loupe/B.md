# Audit round 79 — loupe (reviewer findings)

## A non-finite factor lands below `minFactor`: the model's clamp normalizes after bounding
- where: packages/loupe/src/model.ts:153 (createLoupeModel, `clamp`)
- scenario: `createLoupeModel({ surface, minFactor: 1, maxFactor: 64 })`, then `setFactor(NaN)` (e.g. a wheel delta producing NaN, or a pref parsed badly). geom's `clamp` passes NaN through (`NaN > hi` and `NaN < lo` are both false), then `normalizeZoom(NaN)` answers `ZOOM_FLOOR`, so `factor` becomes `ZOOM_FLOOR`, far below the `minFactor: 1` the options promise "`factor` and `setFactor` clamp to". Likewise `opts.factor: NaN` at construction. Normalizing before clamping (or clamping the normalized value) keeps the factor inside the bounds.
- evidence: read (packages/geom/src/scalar.ts:25 `clamp`, packages/geom/src/view.ts:32 `normalizeZoom`)
- severity: low

## `holdPin` samples and redraws a hidden lens, where every other aim entry point refuses while hidden
- where: packages/loupe/src/model.ts:227 (createLoupeModel, `holdPin`)
- scenario: lens off screen (`surface.hidden()` true); consumer restores a saved pin with `holdPin(c)`. `aimed()` runs `sampleColor()` (or arms the frame sample) and `surface.changed()`, so `onColorChange` fires with a color read for a lens nobody sees. `aimAt`/`pinAt` go through `refuses` (hidden → ignored) and `resample` is documented "Ignored while hidden", so the same question — does a hidden lens sample its aim — is answered two ways. The pin itself should still be taken; the sample should wait (or `hidden()` should gate `aimed()`).
- evidence: read
- severity: low

## `CanvasSource.pixel` throws on a tainted canvas instead of answering `null`
- where: packages/loupe/src/canvasSource.ts:206 (createCanvasSource, `pixel`)
- scenario: a 2D canvas that has had a cross-origin image drawn into it without CORS is tainted; `probe.drawImage(frame, …)` taints the probe and `getImageData` throws `SecurityError`. That propagates through `canvasPixelSource` → `createSampler().rgba` → a loupe surface's `sample` → `LoupeModel.aimAt`, so every hover throws out of the `loupe.aim` action. The contract says `pixel` answers `null` where the source "cannot say"; the read should catch and answer `null`.
- evidence: read (inference about the browser's taint behavior; not run)
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

<!-- done: 3 findings, files read: 11 -->
