## parityDevice's loss handler can drop a newer device's cache, leaking that device, when releaseDevice runs while one is still opening
- where: packages/renderer/src/testing/parityHarness.ts:73 (openDevice)
- scenario: `parityDevice()` starts P1 and `openDevice` awaits `requestRendererDevice()`. Before that resolves, `releaseDevice()` sets `device = null` and `parityDevice()` is called again, so `device = P2`. P1's body then resumes and reads `held = device`, which is P2 and not its own promise. `releaseDevice`'s `.then` destroys P1's GPU, and P1's `lost` handler sees `device === held` (P2) and sets `device = null`. The next `parityDevice()` opens a third device. P2's device is never destroyed, and its uncaptured errors keep landing in `errors`. `held` is meant to be the promise this call made, but it is read after an await, so it picks up whichever promise is current at that point.
- evidence: read
- severity: low

## trimClip's `paint` makes a fresh WebGL context on every call and never releases it
- where: packages/renderer/src/testing/trimClip.ts:41 (paint) and :28 (disposeAfterEach)
- scenario: each `capCases`/`paintCases`/`stencilCases` test calls `paint` 10 times (5 trims × clipped and rebuilt), and each call opens a new `webgl2` context. `disposeAfterEach` only calls `WeaselRenderer.dispose()`, which never calls `loseContext` (nothing in renderer src outside tests does). Every context therefore stays live until GC. Across a file's ~50 tests that is hundreds of contexts, and Chromium force-loses the oldest one past its limit of about 16 ("Too many active WebGL contexts"). parityHarness's `closeBackends` releases each context with `WEBGL_lose_context` for exactly this reason ("a page holds only so many"), so the two harnesses handle the same resource two different ways.
- evidence: read
- severity: low

## The GL recorder returns a fresh number for every getAttribLocation call, ignoring bindAttribLocation
- where: packages/renderer/src/testing/glRecorder.ts:196 (createGLRecorder handler)
- scenario: `GlProgram` calls `bindAttribLocation(program, POSITION_ATTRIBUTE_LOCATION /*0*/, 'a_position')` before linking, then looks attributes up with `getAttribLocation`. The recorder answers `minted++`: an arbitrary, ever-growing number (it can pass 16, the real attribute limit), different on every call for the same program and name. A real context returns 0 for `a_position` and the same location for repeated lookups. A test reading the recorded `vertexAttribPointer` or `enableVertexAttribArray` locations sees values no real context could produce. The bound-location contract can't be checked, and two lookups of one attribute disagree. `getUniformLocation` has the same per-call instability for repeated lookups of one name.
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

<!-- done: 3 findings, files read: 12 -->
