## A tool's static cursor that fails to resolve throws out of the canvas's render; only a function cursor is guarded
- where: packages/core/src/canvas/useToolCursor.ts:10 (resolveToolsCursor)
- scenario: a tool declares `cursor: { glyph: 'pencil', mark: 'rect' }` (a mark on a glyph with no slot) or an unknown glyph. `resolveCursor` throws (`/no slot/`, `/unknown cursor glyph/`, see packages/cursor/src/resolve.ts:61-72), and since the static branch `return resolveCursor(tool.cursor)` sits outside the `try`, the throw escapes `useToolCursor` during the canvas's render and unmounts the canvas whenever that tool is routed. The same spec returned from a `cursor()` function is caught, logged once, and drawn with no cursor. The two paths answer the same failure in two different ways; the static one should go through the same guard.
- evidence: read
- severity: medium

## `onCommit: 'paint'`'s first in-place paint bypasses the frame loop: no visibility gate, no before-paint or frame subscribers, no throw recovery
- where: packages/core/src/canvas/useCanvasSurface.ts:60 (useCanvasSurface → useRedrawOnCommit, line 84)
- scenario: `useRedrawOnCommit` is handed `() => paint(lease)`, the raw paint, not the loop's `runPaint`. On the first commit (and on each commit after one whose paint returned false) of `DrawCanvas` / `SceneViewCanvas`, which both pass `onCommit: 'paint'`, it paints directly. (1) It ignores `frame.isVisible()`, though `useFrameLoop.redraw` notes that the gate must suppress sync paints because a background tab still commits React updates. A surface mounted in a hidden tab or offscreen `target` paints anyway. (2) `subscribeBeforePaint` subscribers are not run before that paint, and `subscribeFrame` subscribers are not told it landed. The frame-loop contract is "on every frame just before its paint" and "after every landed paint". (3) `dirtyRef` stays true and `lastTimeRef` is not advanced. (4) A throwing paint is not marked dirty or retried, as `runPaint`'s catch does. Expected: the in-place paint goes through the loop (as `paintNow` does), with only its landed result reported back.
- evidence: read
- severity: medium

## Shader-source redraw splits the program-id key on `|`, so an id containing `|` is watched as two wrong ids
- where: packages/core/src/canvas/useCanvasRenderer.ts:53 (useRedrawOnShaderSource)
- scenario: `shaderKeyOf` joins handle ids with `|` (canvasRenderer.ts:129-130), and this hook recovers the ids with `key.split('|')`. A custom program registered as `'fx|glow'` is looked up as `'fx'` and `'glow'`, `getProgramSource` returns undefined for both forever, and re-registering `'fx|glow'` with new source never repaints the surface. The ids should be kept as a list (memoized on the key) rather than re-derived by splitting a lossy join.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/trimOverrides.ts
packages/core/src/canvas/useCanvasElements.ts
packages/core/src/canvas/useCanvasHandle.ts
packages/core/src/canvas/useCanvasPaint.ts
packages/core/src/canvas/useCanvasRenderer.ts
packages/core/src/canvas/useCanvasSurface.ts
packages/core/src/canvas/useCanvasView.ts
packages/core/src/canvas/useClientToWorld.ts
packages/core/src/canvas/useExtraLayers.ts
packages/core/src/canvas/useFrameLoop.ts
packages/core/src/canvas/useHitObserver.ts
packages/core/src/canvas/useHostAnchor.ts
packages/core/src/canvas/useInFlightBounds.ts
packages/core/src/canvas/useLateContentRedraw.ts
packages/core/src/canvas/useLayerStack.ts
packages/core/src/canvas/usePaintedCursor.ts
packages/core/src/canvas/useRedrawOn.ts
packages/core/src/canvas/useSceneAdapter.ts
packages/core/src/canvas/useSceneLayersKey.ts
packages/core/src/canvas/useSurfaceInput.ts
packages/core/src/canvas/useSurfaceSize.ts
packages/core/src/canvas/useToolCursor.ts
packages/core/src/canvas/useViewAim.ts
packages/core/src/canvas/useViewClientMaps.ts
packages/core/src/canvas/useViewDispatcher.ts
packages/core/src/canvas/useViewHelpers.ts
packages/core/src/canvas/useViewLayerGate.ts
packages/core/src/canvas/useViewNesting.ts
packages/core/src/canvas/useViewOwnDeps.ts
packages/core/src/canvas/useViewPicking.ts
packages/core/src/canvas/useViewRegistrySurface.ts
packages/core/src/canvas/viewInputs.tsx
packages/core/src/canvas/viewMarkers.ts
packages/core/src/canvas/viewRegistry.tsx
packages/core/src/canvas/viewSnap.ts
packages/core/src/canvas/warmRender.ts
packages/core/src/canvas/wrapNodeOutput.ts

<!-- done: 3 findings, files read: 37 -->
