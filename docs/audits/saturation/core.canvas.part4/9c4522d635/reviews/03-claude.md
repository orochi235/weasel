# Findings: core.canvas.part4

## A `parent` cycle between views recurses without bound in `drawnLayers` and `layerIsPainted`
- where: packages/core/src/canvas/useViewNesting.ts:91 (drawnLayers), :102 (layerIsPainted)
- scenario: two `<CanvasView>`s name each other as `parent` (A `parent="B"`, B `parent="A"`), or a longer chain loops back. The registry expects this input: `nestedOrder` in viewRegistry.tsx places "one caught in a cycle" last, `within` keeps a `seen` set, and `frameIn` here guards with `measuring`. But `drawnLayers` calls `parentReg()?.drawnLayers()`, and `layerIsPainted` calls `parentReg()?.layerIsPainted(layerId)`. Neither has a re-entrancy guard (`ofFollowed`'s `following` guards only the `follows` path). A paint, a pick or a hover then calls A → B → A … until the stack overflows (RangeError). It should end the way `frameIn` does: no frame, no layers / not painted.
- evidence: read
- severity: medium

## A tool's static cursor spec that `resolveCursor` rejects throws out of the canvas render; the thunk form is caught
- where: packages/core/src/canvas/useToolCursor.ts:10 (resolveToolsCursor)
- scenario: a tool declares `cursor: { glyph: 'no-such-glyph' }`, or a `mark` on a glyph with no slot. `resolveCursor` "throws, on every tier, for a glyph the set lacks and for a mark on a glyph with no slot" (packages/cursor/src/resolve.ts:61). The `typeof tool.cursor !== 'function'` branch calls it outside the `try`, so the throw escapes `useToolCursor` during the Canvas render and takes down the canvas subtree. The same spec returned from `cursor()` is caught, logged once, and leaves the tool showing no cursor of its own. The same bad input gets two different answers depending on its form; the static branch should go through the same catch.
- evidence: read
- severity: medium

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

<!-- done: 2 findings, files read: 37 -->
