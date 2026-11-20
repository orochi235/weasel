I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole findings document is below.

# Audit round 54 — renderer.testing

The frozen commit 608f35f isn't in this clone. I read HEAD (830b463cc1), which has no changes under `packages/renderer/src/testing`, so the line numbers below come from that tree.

## stagedVertices drops every run drawn with the several-matrices (or hull) batch variant
- where: packages/renderer/src/testing/recorderCtx.ts:68 (isBatchBuild), used by stagedVertices at :102
- scenario: `flushBatch` draws with `ctx.batchVariants.get(several, hulls, area)` whenever a run holds more than one matrix or carries hulls (flushBatch.ts:46-48). `createRecorderCtx` builds the `get(true, false)` variant before the reset (line 34), so tests are meant to draw with it. But `isBatchBuild` only accepts `ctx.batchFill` and the `get(false, false, true)` area build. If two items under different transforms go into one run, `useProgram` names the several-matrices variant, `isBatchBuild` returns false, and `stagedVertices` throws those uploads away. `paintModes` and `positionsOfMode` then report an empty set or only part of the run, when they should report every vertex the batch staged.
- evidence: read (recorderCtx.ts:34-36, :66-70, :97-104; draw/flushBatch.ts:44-49)
- severity: medium

## The GL recorder's proxy returns a function for `then`, so awaiting or resolving with `gl` hangs
- where: packages/renderer/src/testing/glRecorder.ts:199-205 (createGLRecorder, Proxy get)
- scenario: for any lowercase property, `get` returns a recording function, and that includes `then`. Take `await setup()` where an async helper returns `recorder.gl`, or `Promise.resolve(gl)`. Promise resolution calls `gl.then(resolve, reject)`, gets `undefined` back, and neither function is ever called. The test hangs until its timeout, and a spurious `then` call is pushed into `calls`. `toJSON` behaves the same way: `JSON.stringify(gl)` records a call and yields `undefined`.
- evidence: read (worked out from how promises resolve; not run)
- severity: low

## The GL recorder is missing constants the WebGL device uses, so they read as 0 and collide
- where: packages/renderer/src/testing/glRecorder.ts:39-122 (GL_CONSTANTS) and :203
- scenario: the file's own comment (lines 104-107) says every framebuffer constant must be in the table, because a missing ALL-CAPS name reads as 0 and an assertion on it compares 0 with 0. The WebGL backend uses several names that are not in the table: `DRAW_FRAMEBUFFER`, `READ_FRAMEBUFFER` (glTargets.ts:86-110, the blit path), `DYNAMIC_DRAW`, `R8`, `RED`, `UNSIGNED_SHORT`, `UNPACK_ALIGNMENT` and `SAMPLES`. Under the recorder, `bindFramebuffer(READ_FRAMEBUFFER, a)` and `bindFramebuffer(DRAW_FRAMEBUFFER, b)` both record target 0. A renderer that swapped them would still pass `expect(args[0]).toBe(gl.DRAW_FRAMEBUFFER)`. `R8` and `RED` also both read as 0, so swapping them would go unnoticed the same way.
- evidence: read (grep of `gl.[A-Z_]+` across renderer/src/gpu/webgl, draw and root, compared with the table)
- severity: low

## fakeGpuDevice's getCurrentTexture keeps the first texture forever, so it ignores canvas resizes
- where: packages/renderer/src/testing/fakeGpuDevice.ts:95-98 (context.getCurrentTexture)
- scenario: `current ??= texture({ size: [canvas.width, canvas.height] })` builds the texture once. A real context hands out a fresh texture each frame, sized to the canvas. If a test renders, resizes the canvas (`canvas.width = 128`) and renders again, `finish` (wgpuTargets.ts:147-150) reads `into.width` as the old 64 and clamps the copy to it. A resize test therefore sees the stale size, and only one `textures` record for the context.
- evidence: read
- severity: low

## trimClip's vertex-color case uses colors sized for the 41-point zigzag but draws them only on the 3-anchor curve
- where: packages/renderer/src/testing/trimClip.ts:180-183 (PAINTS 'vertex colors') and :190 (paintCases)
- scenario: `vertexColors` must hold 4 × countPathAnchors(path) values (paint.ts:208). The fixture holds 41 anchors' worth, which fits the zigzag. But `paintCases` runs the vertex-color entry only on the curve (`M … C … S …`, 3 anchors), so only the first three colors are used: [0, .4, 1], [.025, .4, .975] and [.05, .4, .95]. They are about 13/255 apart from end to end. With a per-channel tolerance of 3, the case can't catch vertex colors anchored or blended wrongly along a clipped ribbon. `wholeCases` also passes the same 164-value array to the star, which has 11 anchors.
- evidence: read (the contract is from paint/src/paint.ts:208; I counted the curve's anchors from its `d` string rather than computing them)
- severity: low

## openBackends leaks a WebGL context and renderer when building either renderer throws
- where: packages/renderer/src/testing/parityHarness.ts:108-121 (openBackends)
- scenario: `glContext` is created at line 113, before `scoped(...)` builds the two renderers. If either constructor throws, `b` is never pushed onto `opened`. `closeBackends` then never disposes the WebGL renderer that was built and never calls `loseContext()` on `glContext`. The harness itself notes that a page holds only so many contexts. Each failing parity case leaves one live context behind, and once enough pile up Chromium starts evicting the oldest ones.
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

<!-- done: 6 findings, files read: 10 -->