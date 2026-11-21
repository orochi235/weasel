I couldn't write `.skulkr/out/findings.md` because the write was denied, so the whole document is below.

# Audit round 65: renderer.testing (blind reviewer)

## createRecorderCtx builds a WeaselRenderer it never disposes, so its image cache stays in the module-wide `live` set for the rest of the file
- where: packages/renderer/src/testing/recorderCtx.ts:24 (createRecorderCtx)
- scenario: `createRecorderCtx()` builds `new WeaselRenderer({ gl: recorder.gl, ... })`. It returns only `{ ctx, calls, gl }`, so nothing can dispose `r`.
  - `GLImageCache`'s constructor runs `live.add(this)` (cache/GLImageCache.ts:85). Only `dispose()` or `abandon()` removes it (:138).
  - The helper is called 80 times across 16 test files. Each call pins a cache, and through it the renderer's device, the recorder and its growing `calls` array, in the module-level set.
  - The global answers built on that set keep asking caches from earlier tests: `releaseImageSource`, "whether any live renderer drew `key` in the latest frame" (:43-45), and `maxImageTextureSide` (:49-53).
  - Example: a cache that drew image key K in test A says K was "drawn in its latest frame" in every later test of the file, because its frame never moves on.
  - Should: return a disposer, or dispose the renderer through the ctx.
- evidence: read
- severity: medium

## The recorder context draws through a second `webglDevice` on the same context, so its GL state cache disagrees with the one the caches upload through
- where: packages/renderer/src/testing/recorderCtx.ts:44 (createRecorderCtx)
- scenario: `ctx.gpu = webglDevice(recorder.gl)` is a new device with its own `GlCache`. Every cache and program was built on `r`'s device and keeps calling that one.
  - `GlCache` skips a bind its own record says is redundant: `useProgram`, `bindVertexArray` and `bindTextures` (glCache.ts:59-72, 186-195).
  - `withTexture` binds a unit and then empties it, without the other cache knowing.
  - An image upload through `imageCache` between two flushes therefore empties the active unit. `ctx.gpu` still believes the unit holds its texture and skips the rebind.
  - A mesh upload that binds a VAO through `r`'s device does the same to `bindVertexArray`.
  - The recorded sequence then lacks binds that `WeaselRenderer.render` issues, since there one device serves both. That contradicts the docstring "Mirrors what WeaselRenderer.render assembles internally".
  - Should: give the ctx the renderer's own device.
- evidence: read
- severity: low

## parityDevice: calling releaseDevice() while a device is still opening lets the old device's loss evict the next device from the cache, and that device is never destroyed
- where: packages/renderer/src/testing/parityHarness.ts:73-77 (openDevice), :156 (releaseDevice)
- scenario: `openDevice` captures `held = device` only after `await requestRendererDevice()`. Sequence:
  1. `parityDevice()` starts opening; P1 is pending.
  2. `releaseDevice()` sets `device = null` and queues P1 for destroy.
  3. `parityDevice()` sets `device = P2`.
  4. P1 resumes and sets `held = device`, which is now P2.
  5. P1's device is destroyed. Its `lost` handler sees `device === held` and sets `device = null`.

  The next `parityDevice()` opens a third device. P2's device is unreachable by `releaseDevice()`, is never destroyed, and keeps pushing into `errors`. Should: capture the promise the open belongs to, not read `device` after the await.
- evidence: read
- severity: low

## The fake GPU device has no `dispatchEvent`, which the renderer calls whenever `GPUUncapturedErrorEvent` exists
- where: packages/renderer/src/testing/fakeGpuDevice.ts:97-98 (fakeGpuDevice)
- scenario: the fake exposes `addEventListener` and `removeEventListener` but not `dispatchEvent`. `wgpuPipelines.ts:97` re-raises a scoped pipeline error with `device.dispatchEvent(new GPUUncapturedErrorEvent(...))` when that class is defined.
  - Under jsdom the class is undefined, so with `failPipelines` the fake never reaches an `uncapturederror` listener, unlike a real device.
  - Where the class is defined (the browser project, or a jsdom polyfill), `failPipelines = true` makes the callback throw `device.dispatchEvent is not a function`. That surfaces as an unhandled rejection instead of the event.
  - Should: expose `dispatchEvent: events.dispatchEvent.bind(events)`.
- evidence: read
- severity: low

## Files read
packages/renderer/src/testing/batch.ts
packages/renderer/src/testing/fakeGpuDevice.ts
packages/renderer/src/testing/glRecorder.ts
packages/renderer/src/testing/ownDrawPaint.ts
packages/renderer/src/testing/parityHarness.ts
packages/renderer/src/testing/rampPosition.ts
packages/renderer/src/testing/recorderCtx.ts
packages/renderer/src/testing/standInKeys.ts
packages/renderer/src/testing/stencilledEvenOdd.ts
packages/renderer/src/testing/trimClip.ts
packages/renderer/src/testing/vertexUploads.ts
packages/renderer/src/testing/wgsl.ts

<!-- done: 4 findings, files read: 12 -->