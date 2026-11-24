# Audit round 82, renderer.testing — blind reviewer findings

## createRecorderCtx draws through a second WebGLDevice whose state cache disagrees with the renderer's own
- where: packages/renderer/src/testing/recorderCtx.ts:44 (createRecorderCtx)
- scenario: `ctx.gpu` is a fresh `webglDevice(recorder.gl)`, but every program in `ctx` (`pathFill`, `batchFill`, the variants) and every cache (`meshCache`, `textureCache`, `gradRamps`, `drawBatch`) was built on the renderer's own device `r`, each holding that device (`GLTextureCache`/`GLMeshCache`/`DrawBatch` constructors take `gpu`). Two `GlCache`s now shadow one context: a uniform write goes through `GlProgram.at` → `this.host.use(this)` (r's cache) while `draw` goes through `ctx.gpu`'s cache (`WebGLDevice.draw` → `cache.useProgram`, `cache.bindVertexArray`). E.g. a batch draw with program P (ctx.gpu caches P), then a uniform set on program Q through r's device (`gl.useProgram(Q)` recorded), then another draw with P whose uniforms are unchanged: ctx.gpu's cache believes P is current and records no `useProgram`, so the recorded stream draws with Q bound. Likewise a mesh/geometry creation on r's device ends with `bindVertexArray(null)` that ctx.gpu's cache never hears of, so its next draw of the same VAO skips the bind. `WeaselRenderer.render` has one device and emits these binds; the recorder ctx does not, so call-sequence assertions and `stagedVertices` (which attributes uploads by the last recorded `useProgram`) can read a different program than the one drawn and drop or misattribute a run's vertices. Should build `ctx.gpu` from the renderer's own device (as `render` does) rather than a second one.
- evidence: read (recorderCtx.ts:44-46, GlProgram.ts:199-201, WebGLDevice.ts:210-234, glCache.ts:63-75, glResources.ts:84-98)
- severity: medium

## openBackends leaks the WebGPU renderer and both contexts when the error scope's pop fails after both renderers were built
- where: packages/renderer/src/testing/parityHarness.ts:136 (openBackends)
- scenario: `scoped` awaits `popErrorScope()` in a `finally` after `fn` returned; if that pop rejects (a device lost mid-build, or a scope imbalance raised by the renderer's own push/pop), `scoped` throws after `built.gl` and the WebGPU renderer both exist. The catch disposes only `built.gl` and loses the GL context; the WebGPU renderer is never disposed, its canvas context never unconfigured, and the backends are never pushed to `opened`, so `closeBackends` cannot reach them either. The `built` record should also hold the gpu renderer and dispose it in the catch.
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

<!-- done: 2 findings, files read: 12 -->
