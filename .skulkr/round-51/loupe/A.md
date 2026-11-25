# Audit round 51 — area `loupe`

Note: the tree checked out is 674caba3dd, not d6aa8f2ede (that object is absent here); `packages/loupe` has no
local changes. Line numbers are against this tree.

## A captured CanvasSource keeps serving its last snapshot after its last reader releases it
- where: packages/loupe/src/canvasSource.ts:153-155 (frame), 184-196 (retain's release)
- scenario: WebGL source without `preserveDrawingBuffer`; a lens retains it, frames are captured
  (`current = true`), then the lens closes and the release drops `readers` to 0. `current` is reset only on the
  next 0→1 retain, never on release, and `capture()` stops copying while `readers === 0`. Any reader that does not
  retain — `canvasPixelSource` → `createSampler` → `createEyedropperModel` (labkit retains only while
  `loupe.visible`, TrialLoupe.tsx:180-181) — gets `frame()` = the frozen snapshot from when the lens was last up, so
  hover/pick report colors of a picture that has since changed. It should answer `null` (no current frame) once
  nothing keeps capturing. The full-canvas snapshot is also kept alive indefinitely after the last
  release (never dropped), and a source never retained gets `null` forever and then logs the "nothing has called
  capture()" warning even though the drawing code does call `capture()`.
- evidence: read
- severity: medium

## capture() on a zero-size canvas leaves the previous frame current
- where: packages/loupe/src/canvasSource.ts:137-138 (capture)
- scenario: a captured canvas is resized to 0×0 (collapsed panel) and drawn; `capture()` returns early without
  clearing `current`, so `frame()`/`pixel()` keep answering the old snapshot's pixels (pixel() checks the
  snapshot's own size, not the canvas's) where the canvas now shows nothing; should answer `null`.
- evidence: read
- severity: low

## The model's initial factor ignores minFactor/maxFactor
- where: packages/loupe/src/model.ts:97 (createLoupeModel)
- scenario: `createLoupeModel({ surface, factor: 32, maxFactor: 16 })` (labkit's hostLoupe passes a stored
  `factor` alongside its bounds; the default 8 with `maxFactor: 4` does the same). `loupe.factor` is 32, outside its
  declared range; the first wheel notch in calls `setFactor(32 * k)`, which clamps to 16, so zooming *in* halves the
  magnification. The initial factor should go through the same `clamp` as `setFactor`.
- evidence: read
- severity: low

## A rejected hover sample leaves the previous point's color as `color`
- where: packages/loupe/src/eyedropper.ts:70-72 (hover)
- scenario: hover A resolves `#ff0000`; hover B's async sampler (WebGPU readback) rejects. The rejection handler
  is `() => undefined`, so `color` stays `#ff0000` and no `onColorChange` fires, though the pointer is at B and
  nothing was read there, contradicting "`color` is always the latest point's". It should settle `null`
  (cannot say), as `leave` and a `null` answer do.
- evidence: read
- severity: low

## A surface that goes `gone()` is only noticed on the next aimAt
- where: packages/loupe/src/model.ts:113-117, 151, 177-181 (subscribeFrame callback, aimAt, resample)
- scenario: the lens's owner removes it while the pointer is still; `gone()` now answers true, but the frame
  subscription stays live, `resample()` keeps sampling the surface, and `onDispose` never fires until some
  later `aimAt`, which may never come. The frame callback and `resample` should check `gone()` and tear down as
  `aimAt` does, per the `LoupeSurface.gone` contract ("The model tears itself down when it is").
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
