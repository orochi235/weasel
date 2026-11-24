# Audit round 82 — renderer.testing (blind reviewer)

## openBackends leaks the WebGPU renderer when the build scope's pop rejects
- where: packages/renderer/src/testing/parityHarness.ts:133 (openBackends)
- scenario: both renderers are constructed inside `scoped`, but only the WebGL one is recorded in `built`. If `popErrorScope` rejects after `fn` returned (the device is lost or destroyed mid-build; `releaseDevice` from another file's teardown can do it), `scoped` throws, the catch disposes `built.gl` and loses its context, and the WebGPU `WeaselRenderer` (with its configured canvas context and GPU targets) is never disposed or unconfigured, and is not in `opened`, so `closeBackends` cannot reach it either. It should be recorded in `built` and disposed alongside the GL one.
- evidence: read
- severity: low

## scoped() lets a popErrorScope rejection replace the error fn threw
- where: packages/renderer/src/testing/parityHarness.ts:111 (scoped)
- scenario: `fn` throws (e.g. a renderer constructor throws on a lost device), then `await gpu.popErrorScope()` in `finally` also rejects (the device is lost, as a real device rejects the pop then). The `finally`'s rejection replaces the original exception, so the test reports "OperationError" from the pop instead of the renderer's actual error. The pop's failure should be caught or recorded so the original error still propagates.
- evidence: read
- severity: low

## metricCases' doc says it runs only open shapes, but it runs every shape
- where: packages/renderer/src/testing/trimClip.ts:239 (metricCases)
- scenario: the docblock says "One test per open shape", but the loop iterates all of `SHAPES`, including 'a closed star', with no `curved`/open filter. A reader picking a case to excuse or extend plans against a closed-shape case that isn't skipped. Fix the doc or filter.
- evidence: read
- severity: low

## paintCases' explanatory docblock is attached to the StrokePaint type, not to paintCases
- where: packages/renderer/src/testing/trimClip.ts:174 (StrokePaint / paintCases)
- scenario: the block "Every paint the clip marks and covers rather than drawing straight … Vertex colors are drawn on the curve alone …" sits directly above a second docblock and `type StrokePaint`, so tooling binds it to nothing (or the type), while `paintCases` at line 205 carries only "One test per shape and paint". The reasoning behind the `tolerance` column and the curve-only vertex-color skip is detached from the code that applies it.
- evidence: read
- severity: low

## ownDrawRect's doc says it makes a 10x10 rect, but `size` is a parameter
- where: packages/renderer/src/testing/ownDrawPaint.ts:22 (ownDrawRect)
- scenario: `ownDrawRect(0, 0, 40)` makes a 40x40 rect; the doc says "A 10x10 rect at `x`" and omits `y`/`size`. The doc should say it's `size` square at (`x`, `y`), 10 by default.
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

<!-- done: 5 findings, files read: 12 -->
