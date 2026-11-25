# Findings: core.canvas.SceneCanvas.part2

## Departure ghosts compose a removed node's children onto its own pose, ignoring `definesFrame` and `childFrame`
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:81 (draw, inner `for (const c of r.children)`)
- scenario: a removed subtree's children are placed with `compose(pose, c.pose)` for every node. The scene places children through `childFrameAt` (composeFrame.ts:120): an envelope group (`dependsOn: 'children'` with `derivePose`, `definesFrame` false) gives its children no frame of its own, and a node with a `childFrame` (such as a scroll offset from `viewPoseAdapter`) shifts it. So when `poseTransition exit` sees off a removed envelope group, its children ghost displaced by the group's own pose instead of where they were drawn; for a scrolled container, they ghost at unscrolled positions. The top-level path already does this correctly through `composeChildFrame(frames, parent, compose)`; the recursion should derive the child frame the same way (envelope → the frame the node itself sits in; otherwise `childFrame` of the node's world pose).
- evidence: read (composeFrame.ts childFrameAt, effectivePose.ts definesFrame/isEnvelope)
- severity: medium

## `DispatcherOverlayStyle` cannot be reached from `<SceneCanvas>`, so the documented way to restyle overlay roles does not exist
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts:131 (useSceneCanvasLayers); style option at packages/core/src/canvas/SceneCanvas/useDispatcherOverlayLayer.ts:65
- scenario: `useSceneCanvasLayers` calls `useDispatcherOverlayLayer({ dispatcher })` with no `style`, and no SceneCanvas prop or layer slot carries one (grep finds no other caller outside tests; the hook is exported only from `import-shims/test-seams`). The changelog that removed `ConnectActionOptions.stroke` tells consumers to use `roles: { connector: … }` on the layer's style instead, and the marquee/lasso `fill`/`stroke`/`dash` knobs are equally unreachable. A consumer of `<SceneCanvas>` therefore cannot restyle a connector or slice cut line, or the marquee, at all.
- evidence: read (grep of `useDispatcherOverlayLayer(` and `DispatcherOverlayStyle` across packages; core CHANGELOG entry)
- severity: medium

## A custom `selectionOverlay` layer entry loses its `before`/`after` anchors, unlike `pathEditingOverlay`
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts:176 (layers memo) with useSelectionOverlayLayer.ts:53
- scenario: `layers={{ selectionOverlay: { layer: myLayer, after: 'grid' } }}` — `useSelectionOverlayLayer` returns only `slot.layer` for a custom entry, and the map then stores `{ layer: selectionOverlayLayer }`, so the caller's anchor is dropped. The `pathEditingOverlay` slot passes a custom entry through whole (`overlaySlot` as given), anchors included. The same question — does a custom entry in a standard slot keep its placement — is answered two ways.
- evidence: read (CustomLayerEntry in layerSlots.ts:23 carries `after`/`before`)
- severity: low

## `selectionOptions.initial` seeds a swapped-in scene with the first render's ids
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53 (useSeed)
- scenario: `first = useRef(initial)` is captured once, but the seed runs again for every new `scene`. A canvas whose `scene` prop changes to scene B together with `selectionOptions.initial` naming B's nodes seeds B with the ids meant for scene A (which B usually does not hold, so nothing or the wrong nodes are selected), never with the current `initial`.
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

<!-- done: 4 findings, files read: 45 -->
