# Findings: core.canvas.SceneCanvas.part2

## Departure ghost drops the inherited paint of a removed container's children
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:72 (useDepartureGhostLayer draw)
- scenario: remove a group whose `fill` is a color, holding a child whose `fill` is `'inherit'`, with `poseTransition` exit on. The ghost calls the wired `drawOne(r.node, drawn, v, scaled)` with no `ctx.inherited`, so `withInheritedPaints` (canvas/inheritedPaints.ts:38) resolves the child's paint through `scene.get(parent)`. The removed group is no longer in the scene, so the lookup finds nothing and the child glides out unfilled. The scene painted it in the group's fill a frame earlier. `usePreviewGhostLayer` (line 103) handles the same case by passing `inherited: inheritedPaintOf(effNode, above())` from the previewed containers, so the two ghost layers answer "what paint does a ghosted child inherit" differently.
- evidence: read (the departure path and withInheritedPaints); the missing fill is inferred and was not run
- severity: medium

## useViewportActions registers on a registry its effect never re-reads
- where: packages/core/src/canvas/SceneCanvas/useViewportActions.ts:57-76 (useViewportActions)
- scenario: the effect reads the registry through `regRef.current`, but its deps are `[panKey, zoomKey, pinchKey, rev]`, with `reg` left out. If the `ActionsRegistry` in scope changes while the canvas stays mounted (an `<ActionsProvider>` handed a new registry), the next render does not rerun the effect. `containerScroll`, `viewport.wheelPan`, `viewport.zoom` and the touch-zoom mute stay on the old registry and are missing from the new one, so the wheel and pinch do nothing. If the first render finds no registry (`r` null), nothing registers until a config key changes. Every sibling hook in this area (useActionTunings, useActionsPropResolver, useContributionRoles) keys its effect on `reg`.
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
