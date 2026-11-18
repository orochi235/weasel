# Audit round 36 — apps.site.demos.part5

## TimelineFramesDemo's save keeps downloading frames after the demo unmounts
- where: apps/site/demos/TimelineFramesDemo.tsx:57 (save)
- scenario: click "save frames" (25 frames at 12 fps, includeEnd, 120 ms apart ≈ 3 s), then navigate to another demo. Nothing aborts `abort.current` on unmount, so the `for await` loop keeps rendering frames from a timeline whose effect cleanup already ran `tl.cancel()`, keeps calling `downloadBlob` for the rest of the frames, and calls `setStatus` on an unmounted component. Teardown should abort the controller (an effect cleanup calling `abort.current?.abort()`).
- evidence: read (renderTimelineFrames only checks `signal`, packages/core/src/canvas/timelineFrames.ts:91)
- severity: medium

## A second "save frames" click while one runs makes "cancel" unable to stop the newer run
- where: apps/site/demos/TimelineFramesDemo.tsx:59-76 (save)
- scenario: click "save frames", click it again a second later. The second run overwrites `abort.current`; when the first run finishes, its `finally` sets `abort.current = null` even though it no longer owns it, so "cancel" then does nothing and the second run downloads every frame. Both runs also interleave downloads and `status` lines. The save should be refused (or the first aborted) while one is running, and `finally` should clear only its own controller.
- evidence: read
- severity: low

## The curve lab's "Near-circle" preset sets no weights, so its promised exact NURBS circle never appears
- where: apps/site/demos/curveLab/presets.ts:33-43 (CURVE_PRESETS 'near-circle')
- scenario: pick "Near-circle (4 anchors at cardinals)". Its description says "NURBS with weights ≈ 0.707 hits an exact circle", but the four anchors carry no `weight`, and `nurbs` reads a missing weight as 1 (packages/geom/src/curves/nurbs.ts:58-59), so the NURBS panel draws a plain non-rational cubic over four open control points: not closed and not a circle. Either the preset carries the weights (and closes the loop) or the description stops promising the circle.
- evidence: read
- severity: low

## The curve lab's inflection overlay misses an inflection whose curvature lands exactly on 0 at a sample
- where: apps/site/demos/curveLab/overlays.ts:107-110 (createInflectionsLayer draw)
- scenario: curvature samples go +k, 0, −k (a straight run or a symmetric S hitting a sample point exactly, e.g. the Bezier/NURBS panels over the collinear anchors of "Sharp corner"). At the zero sample the test requires `ks[i] !== 0`; at the next sample `ks[i - 1] === 0` makes it `continue`. The sign change is never compared across the zero, so no marker is drawn. The check should compare against the last nonzero curvature.
- evidence: read
- severity: low

## VertexColorAnimationDemo's tween or stagger clicked mid-flight snaps the wave back and replays the same transition
- where: apps/site/demos/VertexColorAnimationDemo.tsx:61-81 (nextColors, tween, stagger)
- scenario: click "tween", then click it again 400 ms into the 800 ms run. `nextColors` reads the node's committed colors, which are still the rainbow because the first run's `onDone` commit has not fired, so the second run is again rainbow → red. The new animation interrupts the first (colorHelpers interrupts whatever animates that node and channel), so the wave jumps from half-red back to full rainbow and the first run's commit never lands. The second click should reverse from the colors on screen toward the other end.
- evidence: read
- severity: low

## TextOutlinesDemo caches a failed font load forever
- where: apps/site/demos/TextOutlinesDemo.tsx:34-41 (loadDemoFace)
- scenario: the first `FontFace(...).load()` rejects (a dropped connection, a 404 from a wrong BASE_URL). `facePromise ??=` keeps that rejected promise, so every later mount of the demo gets the same rejection and never retries, `registerCanvasFont` never runs, and the canvas-SDF tier renders the browser's fallback face under the demo's family name. The `void loadDemoFace()` call also leaves the rejection unhandled. The cache should be cleared on rejection.
- evidence: read
- severity: low

## TrialClockDemo's Pause then Play drops reverse playback, and Reverse while paused starts playing
- where: apps/site/demos/TrialClockDemo.tsx:23-28 (Controls)
- scenario: click Reverse (rate −1), then Pause (rate 0), then Play: Play writes `rate = 1`, so the orbit resumes forward and the second button flips back to "Reverse". Separately, while paused `forward` is `rate >= 0` = true, so clicking "Reverse" writes `rate = -1` and the paused clock starts running. Direction and paused-ness are one number here; the demo needs to keep the last direction to restore on Play and to change only the direction while paused.
- evidence: read
- severity: low

## Files read
apps/site/demos/SymmetryLabDemo.tsx
apps/site/demos/TextDemo.tsx
apps/site/demos/TextOutlinesDemo.module.css
apps/site/demos/TextOutlinesDemo.tsx
apps/site/demos/TextScriptDemo.module.css
apps/site/demos/TextScriptDemo.tsx
apps/site/demos/TiledSurfaceDemo.tsx
apps/site/demos/TimelineDemo.tsx
apps/site/demos/TimelineFramesDemo.tsx
apps/site/demos/ToolReflectionDemo.module.css
apps/site/demos/ToolReflectionDemo.tsx
apps/site/demos/TransformDemo.tsx
apps/site/demos/TrialClockDemo.module.css
apps/site/demos/TrialClockDemo.tsx
apps/site/demos/TugLabDemo.tsx
apps/site/demos/TweenLabDemo.tsx
apps/site/demos/VertexColorAnimationDemo.tsx
apps/site/demos/ViewportDemo.tsx
apps/site/demos/WhiteboardDemo.tsx
apps/site/demos/animation/AnimatorWatch.tsx
apps/site/demos/animation/FlickSnapPanel.tsx
apps/site/demos/curveLab/ReadoutHud.tsx
apps/site/demos/curveLab/RepresentationPanel.tsx
apps/site/demos/curveLab/curveScene.ts
apps/site/demos/curveLab/overlays.ts
apps/site/demos/curveLab/presets.ts
apps/site/demos/customShaderPrograms.ts
apps/site/demos/diagram/shared.ts
apps/site/demos/ditherDemoExport.ts
apps/site/demos/ditherDemoScene.ts
apps/site/demos/effectChartPictures.ts
apps/site/demos/forceGraph/graph.ts
apps/site/demos/forceGraph/overrides.ts
apps/site/demos/pathEditLabScene.ts
apps/site/demos/pathEffectLab.module.css
apps/site/demos/pathEffectLab.tsx
apps/site/demos/pathLab/pathLab.module.css
apps/site/demos/pathLab/pathLab.tsx
apps/site/demos/pinWarpSolverLab/PinWarpSolverLab.module.css
apps/site/demos/pinWarpSolverLab/SolverPanel.tsx
apps/site/demos/pinWarpSolverLab/meshLayer.ts
apps/site/demos/pinWarpSolverLab/meshModel.ts
apps/site/demos/pinWarpSolverLab/presets.ts
apps/site/demos/pinWarpSolverLab/solverTrace.ts
apps/site/demos/rotatedResize/math.ts
apps/site/demos/rotatedResize/panels.tsx
apps/site/demos/score/scoreRoll.ts
apps/site/demos/warpLab.tsx

<!-- done: 7 findings, files read: 48 -->
