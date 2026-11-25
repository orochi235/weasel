# Findings: core.canvas.SceneCanvas.part2 (round 72)

## Content-bounds cache ignores the camera, though the bounds it caches depend on it
- where: packages/core/src/canvas/SceneCanvas/useContentBounds.ts:44-60 (useContentBounds)
- scenario: The cached `committed` box is keyed on scene, `boundsOf` identity and scene version, and dropped on override/scroll writes. The `boundsOf` it is handed (SceneCanvasInput passes `picking.boundsOf`, i.e. `useScenePickers`' `wiredBoundsOf`) reads the surface's live camera through `getViewRef`: a node on a parallax layer is boxed through `rectFromPlane(plane(view))`, and the stroke-inclusive box takes `view.scale`. Pan or zoom a canvas with a parallax layer (or a scale-dependent stroke) without editing the scene → `viewBounds: 'content'` clamping and edge-pan `limit: { past }` keep reading the box computed at the old camera until some unrelated edit bumps the version. Should recompute when the view moves (or key on it).
- evidence: read
- severity: medium

## Departure ghosts lose the paint a removed child inherits from its removed container
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:63-75 (draw)
- scenario: Remove a group whose `fill`/`stroke` is set and whose child has `fill: 'inherit'`, under `poseTransition` with `exit`. The child is drawn as `r.children` of the removal through `slot.drawOne(r.node, drawn, v, scaled)`; `scaled` carries no `inherited`, so the scene-wired `drawOne` (`withInheritedPaints`) resolves it with `inheritedPaintIn(scene, node)`, walking `scene.get(node.parent)`, and the parent is already gone from the scene. The ghost of the child paints with the default ink instead of the group's paint, so the leaving group visibly changes color as it fades. `usePreviewGhostLayer` answers the same question the other way: it threads the containers down (`above`) and passes `inherited: inheritedPaintOf(effNode, above())`. The departure walk should pass the removed ancestors the same way.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/SceneCanvas/toolProps.ts
packages/core/src/canvas/SceneCanvas/toolRegistry.ts
packages/core/src/canvas/SceneCanvas/useActionTunings.ts
packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts
packages/core/src/canvas/SceneCanvas/useBakedScene.ts
packages/core/src/canvas/SceneCanvas/useBestHit.ts
packages/core/src/canvas/SceneCanvas/useBuiltinTools.ts
packages/core/src/canvas/SceneCanvas/useCanvasCamera.ts
packages/core/src/canvas/SceneCanvas/useCanvasDispatcher.ts
packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts
packages/core/src/canvas/SceneCanvas/useCanvasTools.ts
packages/core/src/canvas/SceneCanvas/useChromeAffordances.ts
packages/core/src/canvas/SceneCanvas/useContentBounds.ts
packages/core/src/canvas/SceneCanvas/useContributionRoles.ts
packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts
packages/core/src/canvas/SceneCanvas/useDispatcherOverlayLayer.ts
packages/core/src/canvas/SceneCanvas/useEdgePan.ts
packages/core/src/canvas/SceneCanvas/useHeldModifiers.ts
packages/core/src/canvas/SceneCanvas/useIgnoredProps.ts
packages/core/src/canvas/SceneCanvas/useMagnificationCheck.ts
packages/core/src/canvas/SceneCanvas/useNodeKinds.ts
packages/core/src/canvas/SceneCanvas/usePresetTraits.ts
packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts
packages/core/src/canvas/SceneCanvas/useSceneCanvasHandle.ts
packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts
packages/core/src/canvas/SceneCanvas/useSceneCanvasPathEdit.ts
packages/core/src/canvas/SceneCanvas/useSceneCanvasTools.ts
packages/core/src/canvas/SceneCanvas/useSceneChrome.ts
packages/core/src/canvas/SceneCanvas/useSceneColorAt.ts
packages/core/src/canvas/SceneCanvas/useSceneGestureDispatcher.ts
packages/core/src/canvas/SceneCanvas/useScenePickers.ts
packages/core/src/canvas/SceneCanvas/useScenePicking.ts
packages/core/src/canvas/SceneCanvas/useSceneRedrawSources.ts
packages/core/src/canvas/SceneCanvas/useSceneSlotLayers.ts
packages/core/src/canvas/SceneCanvas/useSceneStandardActions.ts
packages/core/src/canvas/SceneCanvas/useSceneWorkerSurface.ts
packages/core/src/canvas/SceneCanvas/useSelectionOverlayLayer.ts
packages/core/src/canvas/SceneCanvas/useSurfaceRouting.ts
packages/core/src/canvas/SceneCanvas/useSurfaceViewInputs.ts
packages/core/src/canvas/SceneCanvas/useToolKeybindings.ts
packages/core/src/canvas/SceneCanvas/useViewportActions.ts
packages/core/src/canvas/SceneCanvas/useViewportWithoutView.ts
packages/core/src/canvas/SceneCanvas/viewportProp.ts
packages/core/src/canvas/SceneCanvas/workerProps.ts
packages/core/src/canvas/SceneCanvas/worldPointAt.ts

<!-- done: 2 findings, files read: 45 -->
