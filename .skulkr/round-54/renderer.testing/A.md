I couldn't write `.skulk/out/findings.md` because permission was denied, so here is the whole document.

## createUploadTracker reads a tightly packed attribute as two floats per vertex whatever its size
- where: packages/renderer/src/testing/vertexUploads.ts:65 (createUploadTracker.uploads)
- scenario: `draw/vertexColors.ts:63` records `vertexAttribPointer(loc, 4, FLOAT, false, 0, 0)` for a vertex-color buffer. `cache/GLMeshCache.ts:175` does the same for an extra attribute of size `attribute.size`. A byte stride of 0 means `components * 4`, so the color buffer holds 4 floats per vertex. The tracker hard-codes `bytes === 0 ? 2` and reports that upload as `stride: 2`. A test splitting the data into vertices then sees twice as many vertices, each holding half a color. When the stride is 0 it should use `call.args[1]` (the size).
- evidence: read
- severity: medium

## fakeGpuDevice's getCurrentTexture keeps the first texture forever, so it ignores canvas resizes
- where: packages/renderer/src/testing/fakeGpuDevice.ts:95 (context.getCurrentTexture)
- scenario: a test sets `fake.canvas.width = 128` after the first frame. A real context would then hand out a new 128-wide texture. The fake returns the 64-wide one it cached (`current ??=`), so `finish()` at `wgpuTargets.ts:148` clamps its copy to `min(frame.width, into.width)` = 64. A resize test sees a stale extent and can pass a renderer that never grew its target. A real context also returns a new texture each frame and the fake never does, so a renderer holding on to a texture past its frame goes unnoticed.
- evidence: read
- severity: medium

## glRecorder's handles and uniform locations repeat after reset(), so different objects look the same
- where: packages/renderer/src/testing/glRecorder.ts:169-173 (handler)
- scenario: handles are `${name}_${calls.length}` and locations are `calls.length`, and `reset()` sets `calls.length = 0`. `createRecorderCtx` resets twice after building its eager programs (recorderCtx.ts:37,41). A program built lazily after that (a batch variant, `trimmedRibbon`, a registered kind) gets uniform locations numbered from 0 again, the same numbers the eager programs got. A test matching `uniform*` calls by `args[0] === glUniformLocation(prog, 'u_x')` can then match another program's uniform with the same number. Handles minted after a reset also deep-equal handles minted before it (`{ __id: 'createBuffer_0' }`). A counter that `reset()` doesn't clear would fix both.
- evidence: read
- severity: medium

## Both recording Proxies answer `then`, so awaiting or resolving the stand-in hangs forever
- where: packages/renderer/src/testing/glRecorder.ts:199-205 (gl Proxy get); packages/renderer/src/testing/fakeGpuDevice.ts:63-64 (renderPass)
- scenario: every lowercase property, `then` included, returns a recording function. So `async () => recorder.gl`, `Promise.resolve(gl)`, or a helper that resolves with a pass encoder treats the stand-in as a thenable. It calls `then(resolve, reject)`, which records a call and returns undefined, and the promise never settles. The test times out instead of failing on its assertion.
- Related: `prop in DATA_PROPERTIES` and `prop in GL_CONSTANTS` walk the prototype chain. So `gl.constructor`, `toString`, `hasOwnProperty` and `valueOf` return `Object.prototype` members without recording, while every other method records.
- Fix: switch both lookups to own keys (`Object.hasOwn`) and exclude `then`.
- evidence: read
- severity: low

## glRecorder reports `gl.canvas` as a function, so a renderer over it never watches for context loss
- where: packages/renderer/src/testing/glRecorder.ts:154-157 (DATA_PROPERTIES)
- scenario: `openWebGL` (gpu/webgl/openWebGL.ts:14) takes `gl.canvas` as the loss target. Through the recorder that is a recording function with no `addEventListener`, so `watchContextLoss` returns null. A renderer over the recorder then has `loss === null` and `isContextLost()` is always false, and reading `canvas` records a spurious call. Other data properties (`drawingBufferColorSpace`, `drawingBufferFormat`) have the same problem. The comment at :151 describes exactly this failure, but the fix covers only the two dimensions.
- evidence: read
- severity: low

## fakeGpuDevice's popErrorScope resolves null on an empty stack, where a real device rejects
- where: packages/renderer/src/testing/fakeGpuDevice.ts:83 (popErrorScope)
- scenario: code that pops one more scope than it pushed gets `null` from the fake. A real GPUDevice rejects with `OperationError`, so the fake hides exactly the imbalance it should expose. Also, with `failPipelines` set and no scope open, `createRenderPipeline` reports nothing (line 79). A real device raises `uncapturederror` there, and the fake has no `addEventListener` to deliver it.
- evidence: read
- severity: low

## parityDevice keeps handing out a lost device and can request two devices at once
- where: packages/renderer/src/testing/parityHarness.ts:61-67 (parityDevice)
- scenario: the cached `device` is cleared only by `releaseDevice`, and nothing watches `device.lost`. If the device is lost partway through a file, every later `openBackends`, `rasterizers` and `requireGpu` gets the dead device, and the tests fail without saying why. Separately, two concurrent first calls (e.g. `Promise.all([requireGpu(ctx), openBackends(...)])`) both see `device === null` and both request a device. The second assignment overwrites the first, which is never destroyed and keeps its error listener.
- evidence: read
- severity: low

## readGpu leaks its readback buffer when mapAsync rejects, and openBackends leaks the GL renderer when the WebGPU one throws
- where: packages/renderer/src/testing/parityHarness.ts:162-169 (readGpu); :115-119 (openBackends)
- scenario: `buffer.destroy()` runs only in the `then` branch, so a rejected `mapAsync` (lost or destroyed device) leaves the `stride*height` buffer alive. In `openBackends`, if `new WeaselRenderer({ gpu: ... })` throws, the WebGL renderer already built never reaches `opened`. `closeBackends` then never disposes it or loses its context, though the doc on `closeBackends` says a page holds only so many contexts.
- evidence: read
- severity: low

## Files read
packages/renderer/src/testing/batch.ts
packages/renderer/src/testing/fakeGpuDevice.ts
packages/renderer/src/testing/glRecorder.ts
packages/renderer/src/testing/ownDrawPaint.ts
packages/renderer/src/testing/parityHarness.ts
packages/renderer/src/testing/recorderCtx.ts
packages/renderer/src/testing/stencilledEvenOdd.ts
packages/renderer/src/testing/trimClip.ts
packages/renderer/src/testing/vertexUploads.ts
packages/renderer/src/testing/wgsl.ts

<!-- done: 8 findings, files read: 10 -->