# Audit round 65 — core.domains

## A pose run whose `step` returns a lazy iterable that throws is left running forever with no frame coming
- where: packages/core/src/domains/poseRun/usePoseRun.ts:146-152 (tick)
- scenario: `PoseRunStep.poses` is typed `Iterable`, so a producer can return a generator. `stepOrElse` guards only the `step(ctx)` call, so the run ends cleanly when `step` throws. The generator's body, though, runs in the `for (const [id, pose] of poses)` loop after `stepOrElse` has returned. If it throws there (a node removed mid-run, say), the exception leaves `tick` with `running.current === true`. No `loop.request()` was made, and the hold keeps the previous frame's overrides on the scene. After that, `isRunning()` reports true, `start()` does nothing because it is "idempotent while running", and the nodes stay drawn at a stale preview until `stop`/`cancel` or unmount. It should end the way a throwing `step` does: halt, then release.
- evidence: read
- severity: low

## A view-marker drag projects the live world point through the target camera captured at press
- where: packages/core/src/domains/viewports/viewMarker.ts:121-127 (grabViewMarker → moveTo), with packages/core/src/domains/viewports/viewMarkerDrag.ts:30
- scenario: `grabViewMarker` closes over `space`, the target view's `AimSpace` built at press (canvas/viewMarkers.ts `targetSpace(target)`). Each move, `moveTo(m.drag.current)` sends the dispatcher's world point back through that press-time `space.project`. The resolver computes the move's world point with the target view's current camera (viewResolver.ts `at` re-reads the pinned view's `view` on each event). Suppose the target camera moves during the drag: a thunked viewport `view(outer, dims)` derived from the camera being dragged, or a minimap that refits to keep the source aim in frame. The world point and the projection then use different cameras, so the marker lands away from the pointer, and with a refitting target it can feed back on itself. Projecting through the camera the world point was computed with (or carrying screen px rather than world) would keep the marker under the pointer.
- evidence: inference (read; no run)
- severity: low

## `mergeVisibilityRules` writes user keys into a plain object, so a `__proto__` chrome id reassigns the prototype and its rule is lost
- where: packages/core/src/domains/chrome-caps/resolve.ts:12-15 (mergeVisibilityRules)
- scenario: `merged` is `{}`, and each key is written with `merged[id] = rule`. A consumer table with an own `__proto__` key (from `JSON.parse` of a saved table, or `Object.defineProperty`) is enumerated by `Object.entries`. The assignment then sets `merged`'s prototype to the rule object instead of storing an entry. `resolveVisibility` looks entries up with `Object.hasOwn`, so the rule for that id is silently dropped and the id falls through to "always visible". Lookups are guarded, but the write is not. `Object.create(null)` or a `Map` keeps every id.
- evidence: read
- severity: low

## Files read
packages/core/src/domains/chrome-caps/conditions.ts
packages/core/src/domains/chrome-caps/defaults.ts
packages/core/src/domains/chrome-caps/index.ts
packages/core/src/domains/chrome-caps/resolve.ts
packages/core/src/domains/chrome-caps/types.ts
packages/core/src/domains/chrome-caps/useChromeCaps.ts
packages/core/src/domains/chrome-caps/useHoverTracking.ts
packages/core/src/domains/ingestion/contentHandlers.ts
packages/core/src/domains/ingestion/index.ts
packages/core/src/domains/ingestion/openFilePicker.ts
packages/core/src/domains/ingestion/placement.ts
packages/core/src/domains/ingestion/useCanvasIngestion.ts
packages/core/src/domains/longPress/longPressFeedback.ts
packages/core/src/domains/modes/modeLayers.ts
packages/core/src/domains/modes/modeTriggers.ts
packages/core/src/domains/pathEffects/effectSources.ts
packages/core/src/domains/pathEffects/hiddenSources.ts
packages/core/src/domains/pathEffects/index.ts
packages/core/src/domains/pathEffects/readSource.ts
packages/core/src/domains/pathEffects/useEffectSourcesLayer.ts
packages/core/src/domains/poseRun/index.ts
packages/core/src/domains/poseRun/usePoseRun.ts
packages/core/src/domains/presentation/index.ts
packages/core/src/domains/presentation/presentationContribution.ts
packages/core/src/domains/presentation/presentationStep.ts
packages/core/src/domains/selection/enteredGroupFrame.ts
packages/core/src/domains/selection/enteredGroupScope.ts
packages/core/src/domains/selection/enteredOperands.ts
packages/core/src/domains/viewports/aim.ts
packages/core/src/domains/viewports/index.ts
packages/core/src/domains/viewports/viewMarker.ts
packages/core/src/domains/viewports/viewMarkerDrag.ts
packages/core/src/domains/viewports/viewResolver.ts
packages/core/src/domains/viewports/viewportLayer.ts

<!-- done: 3 findings, files read: 34 -->
