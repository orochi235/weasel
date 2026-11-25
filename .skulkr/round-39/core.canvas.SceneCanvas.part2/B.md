# Audit round 39 — core.canvas.SceneCanvas.part2

## Preview ghost paints descendants the scene does not draw: hidden nodes and nodes on hidden layers
- where: packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts:91 (drawEntry)
- scenario: under a frame-composing scene, drag a container (a frame-defining group) on a visible layer whose child is `hidden: true`, or whose child sits on a layer with `visible: false`. `resolvePreviews` carries every child of a frame-defining container, and `drawEntry` calls `drawOne` for each entry with no gate, so for the length of the drag the ghost shows the hidden child, which the committed scene never paints (`buildSceneTree` skips `hidesSubtree` subtrees and gives a hidden layer no bucket). The same question is answered the other way next door: `useDepartureGhostLayer` checks `shown.has(layer)` before painting a departing node. The ghost should skip a `hidden` entry's subtree and paint nothing for a node on a hidden layer (as `buildSceneTree` and the departure ghost do).
- evidence: read (usePreviewGhostLayer.ts:91-115 has no visibility/hidden gate; resolvePreviews.ts:104-111 includes children when `carries`; buildSceneTree.ts:113-115,137 gates both; useDepartureGhostLayer.ts:53,64 gates layer visibility)
- severity: medium

## Preview and departure ghosts paint at the world pose, ignoring the scene slot's `drawnPose` (the quantize rule's drawn half)
- where: packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts:101 (drawEntry); packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:65 (draw)
- scenario: a scene with a quantize rule whose `drawn` half moves nodes onto an output grid. `wireSceneSlotToScene` puts that on the wired slot as `drawnPose`, and `buildSceneTree` paints every node at `drawnPose(node, pose)`. Both ghost layers take that same wired slot but call `drawOne(node, pose, …)` with the raw world pose. So when a drag starts, a ghosted node (and every opaque sibling reflowing in `settled`) is painted off the grid, shifted by up to a grid step from where the committed paint had it, and a departing node jumps off the grid the moment its exit glide starts. The ghosts should paint at `slot.drawnPose?.(node, pose) ?? pose`, as the scene does.
- evidence: read (sceneSlotWiring.ts:48,56 adds `drawnPose`; buildSceneTree.ts:147-149 paints at it; usePreviewGhostLayer.ts:101 and useDepartureGhostLayer.ts:65 do not read it)
- severity: medium

## Departure ghost fades out nodes the scene never painted: `hidden` nodes and hidden members of a removed group
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:58 (draw)
- scenario: with `poseTransition` exit on, delete a group one of whose children is `hidden: true` (or delete a hidden node itself). `buildSceneTree` skips a `hidesSubtree` node and its subtree, so it was never on screen, but the departure ghost gates only on layer visibility (`shown.has(layer)`) and walks every `r.children`, so the hidden node appears for the length of the exit glide. It should skip a hidden node's subtree, as the scene walk does.
- evidence: read (useDepartureGhostLayer.ts:61-66 checks only the layer; buildSceneTree.ts:137 `if (!node || hidesSubtree(node)) return`; no hidden filter in animation/ or poseWrites.ts)
- severity: low

## The `actions` prop never reaches tool- and contribution-owned actions: they register after its resolver runs
- where: packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:27 (useActionsPropResolver), called from useSceneStandardActions.ts:215
- scenario: `useSceneStandardActions` (with the resolver's effect) and `useToolKeybindings` → `useContributionRoles` (whose effect registers every entry's `actions`, ToolDef-owned and ambient) are both called in `SceneCanvasInput`, standard actions first (SceneCanvasInput.tsx:139 vs :190), so in one commit the resolver's effect runs before the tool actions exist. `<SceneCanvas defaultTools={['polygon']} actions={{ 'polygon.adjustSides': { label: 'Sides' } }}>` finds no `existing`, warns "is a partial Action but no default with this id exists", and drops the override, though the action is registered a moment later. `actions={null}` ("disable all defaults") mutes only `reg.list()` at that moment, so `polygon.adjustSides` and every preset/ambient contribution's actions stay live (`useCanvasTools` special-cases only the marker drag for `actions === null`). And when the tool registry changes, `useContributionRoles` re-registers the tool's descriptor on top of any merged override, while the resolver's `rev` (`standardActionsKey`) does not move. The resolver should run after the contribution registrations, or be re-keyed on them.
- evidence: read (useSceneStandardActions.ts:215 `useActionsPropResolver(props.actions, standardActionsKey)`; useContributionRoles.ts:112-125 registers `entry.actions` in a later effect of the same component; useActionsPropResolver.ts:34,50-62 reads `reg.list()` once; editing's usePolygonTool.tsx:55,74 declares `polygon.adjustSides` on `ToolDef.actions`)
- severity: medium

## The `colorAt` dep ignores `layerOrder`: it samples scene layers the canvas does not draw, stacked in the wrong order
- where: packages/core/src/canvas/SceneCanvas/useSceneColorAt.ts:16 (documentLayersOf), wired at SceneCanvasInput.tsx:150
- scenario: `<SceneCanvas layerOrder={['grid', 'scene:fg', 'scene:bg', ...]}>` (bg drawn over fg), or a `layerOrder` that leaves `scene:draft` out. The canvas paints bg over fg and no draft at all, and picking agrees (`useScenePicking` gates on `useViewLayerGate(layerVisibility, layerOrder, …)`). But `documentLayersOf` filters only by `layerVisibility` and keeps the slot's own order, so the eyedropper (`colorAt`) composites `scene:draft`'s ink, which is not on screen, and stacks fg over bg, returning the color of the layer that is underneath on screen wherever the two overlap. It should narrow and order the slot's layers by `layerOrder` as `<Canvas>` does (`CanvasProps.layerOrder`: "a layer whose id is missing from it is not drawn").
- evidence: read (useSceneColorAt.ts:16-25 takes no `layerOrder`; the SceneCanvasInput.tsx:150-153 call passes none; props.ts:394-399 and useScenePicking.ts:64-66 treat `layerOrder` as gating paint and picking)
- severity: low

## Hover is only tracked when the `chromeVisibility` prop or `onHoverChange` is given, so `hovering` rules set any other way never match
- where: packages/core/src/canvas/SceneCanvas/useSceneChrome.ts:138 (useSceneCanvasChrome)
- scenario: a canvas with no `chromeVisibility` prop and no hover callback. Hover tracking is switched off (`enabled: rules.chromeVisibility !== undefined || args.hover.onChange !== undefined`), so `getHover()` stays `null` (useHoverTracking attaches no listeners). Two other paths still put hover-reading rules on that canvas: the `chromeRules` dep this same hook sources (`deps.chromeRules.set('selection.handles', hovering)`, which useChromeRulesDep lays over the rules at run time), and binding eligibility, since `getRuleCtx` feeds the dispatcher and `rule.ts` matches `hovering` / `hoveringSelected` against `ctx.hover`. On such a canvas a chrome rule set through the dep with `hovering` never shows, and a binding gated on `{ hovering: true }` never fires. The gate is decided from the prop alone, not from the rules actually in force. It should track whenever a merged rule or a binding can read hover, or simply always track.
- evidence: read (useSceneChrome.ts:137-142; deps/chromeRules.ts:33-41 merges dep-set rules after the enable decision; useHoverTracking.ts:48 returns early when disabled; routing eligibility/rule.ts:104-107 reads `ctx.hover`)
- severity: medium

## `useBakedScene` hands a later `SerializedScene` prop through as a live `Scene`
- where: packages/core/src/canvas/SceneCanvas/useBakedScene.ts:20 (useBakedScene)
- scenario: mount `<SceneCanvas scene={liveScene}>`, then set `scene={json}`, for example after opening a file into the same canvas. The baked state was decided on the first render (`null`, since the first input was live), so the hook returns `sceneInput as Scene`, which is the plain JSON object. The canvas then calls `scene.subscribe`, `getVersion`, `get` and so on on it, and throws. The doc says later changes are "ignored", but this one is not ignored: it is used, cast to the wrong type. It should bake JSON whenever the input is serialized (or keep the first scene, as the doc promises), never return a serialized scene.
- evidence: read (useBakedScene.ts:17-20: the `useState` initializer runs once; the fallback casts whatever the current input is)
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

<!-- done: 7 findings, files read: 45 -->
