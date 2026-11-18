# Audit round 36 — apps.site.demos.part5

## A second "save frames" click while one is running leaves the looping ball frozen and the first run uncancelable
- where: apps/site/demos/TimelineFramesDemo.tsx:57 (save)
- scenario: click "save frames", then click it again before the first finishes (the downloads are 120 ms apart, 25 frames ≈ 3 s). The second `renderTimelineFrames` reads `wasPaused = true` (the first already paused the timeline), so whichever finishes last restores "paused at a frame time": the first run's `finally` resumes and seeks, the second keeps seeking the same handle underneath it, then ends with `seek(wasAt)` and no resume. The demo has no transport, so the ball stays frozen until remount. Meanwhile `abort.current` is overwritten by the second controller and nulled by whichever `finally` runs first, so "cancel" can no longer stop the run that is still going. Should refuse (or abort the previous run) while one is in flight.
- evidence: read (packages/core/src/canvas/timelineFrames.ts:85–103 for the pause/restore)
- severity: medium

## Unmounting the frames demo mid-save keeps downloading and setting state
- where: apps/site/demos/TimelineFramesDemo.tsx:37 (abort ref, no unmount cleanup)
- scenario: start "save frames", navigate to another demo. Nothing aborts `abort.current` on unmount, so the `for await` loop keeps rendering frames from the unmounted scene and calling `downloadBlob` for every remaining frame, plus `setStatus` on an unmounted component. Should abort the controller in an effect cleanup.
- evidence: read
- severity: low

## Flick-to-grid flings a block released after holding still, from stale velocity samples
- where: apps/site/demos/animation/FlickSnapPanel.tsx:80 (flickToGrid onEnd)
- scenario: drag the block quickly, stop and hold the pointer still for a second, then release. `tracker.getVelocity()` is called with no `now`, so it averages whatever samples the last `record` kept (pruning happens only inside `record`, and no `onMove` fires while the pointer is still). The block is launched at the velocity of the earlier fast motion instead of ~0, and coasts away before snapping. Should be `tracker.getVelocity(performance.now())`, the form `createVelocityTracker` provides for exactly this (packages/core/src/core/viewport/createVelocityTracker.ts:25).
- evidence: read
- severity: medium

## A drop with fewer than two move samples lands off the grid
- where: apps/site/demos/animation/FlickSnapPanel.tsx:81–98 (flickToGrid onEnd)
- scenario: drag the block with a single pointermove (a quick nudge, or a drag whose moves coalesce into one event), or with velocity under `restThreshold` (0.01 px/s). The tracker reports `{0, 0}`, the decay ends on its first tick (`physicsAnimation.ts:91`), and `onDone → land()` clears `flight.current` before the 180 ms timer, so `setTarget` to the nearest cell never runs and the block is committed wherever it was dropped, off the grid the demo promises to snap to. The snap should be applied when the flight ends before the coast does.
- evidence: read (packages/animator/src/engine/physicsAnimation.ts:66–91)
- severity: low

## Pausing the trial clock forgets its direction, and "Reverse" while paused starts it playing
- where: apps/site/demos/TrialClockDemo.tsx:19–28 (Controls)
- scenario: click Reverse (rate −1), then Pause (rate 0), then Play: Play sets `rate = 1`, so the planet now runs forward. While paused, `forward = clock.rate >= 0` is true, so the second button reads "Reverse" whatever the direction was, and clicking it sets rate −1, which unpauses the clock. Direction and play state are both folded into `rate`; the demo needs to remember the direction across a pause.
- evidence: read
- severity: low

## Clicking "tween" or "stagger" again mid-run snaps the wave back to its old colors instead of reversing
- where: apps/site/demos/VertexColorAnimationDemo.tsx:61–81 (nextColors, tween, stagger)
- scenario: click "tween", then click it again 300 ms into the 800 ms run. `nextColors` reads `from` and picks `to` from the node's committed `vertexColors`, which stay RAINBOW until the first run's `onDone` commits. So the second run starts from RAINBOW (the wave visibly jumps back from its half-red state) and heads to RED again, so the button does not toggle. Every click during a run restarts the same transition from the start. `from` should be the colors on screen (the running override), and `to` should be chosen from where the last run was headed.
- evidence: read (packages/animator/src/colorHelpers.ts:85 takes `from` as given)
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
