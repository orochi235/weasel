## `DispatcherOverlayStyle` is unreachable: the canvas never passes a style to the overlay layer
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts:150 (useSceneCanvasLayers → `useDispatcherOverlayLayer({ dispatcher })`)
- scenario: a consumer wants to restyle the marquee/lasso or one polyline role, as the changelogs say to ("`DispatcherOverlayStyle.roles` is where a consumer restyles one"). No `<SceneCanvas>` prop reaches `useDispatcherOverlayLayer`'s `style` (grep: the type is exported only through `import-shims/test-seams.ts`), so `fill`/`stroke`/`dash`/`lineWidth`/`roles` always fall back to `DEFAULT_STYLE` and `OVERLAY_ROLE_STROKES`. The documented restyling path does nothing.
- evidence: read (useSceneCanvasLayers.ts, useDispatcherOverlayLayer.ts, grep for DispatcherOverlayStyle across packages)
- severity: medium

## A preset's own tool that inserts nothing stays registered when `defaultTools` or `tools.<id>=true` also names it
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:53-70 (resolveToolRegistry)
- scenario: a preset's own tool id is in `args.offered` (the build's winner). If `defaultTools` lists that id, or the patch sets it to `true`, the first loop puts it in `registry` (`asked` is true, `offered` holds it). The second loop then finds `insertsNothing(tool, insertBuilds)` true and `continue`s, but never removes the entry the first loop wrote. The tool that "is left out, so it cannot be chosen" stays choosable, and the dev warning saying it was left out fires anyway. It should be deleted from `registry` (or the first loop should skip own-tool ids).
- evidence: read (inference from the two loops; no test run)
- severity: low

## Changing the standard action objects without changing their ids buries a configured pinch zoom under the kit's default
- where: packages/core/src/canvas/SceneCanvas/useSceneStandardActions.ts:149-158 (`rev: standardActionsKey`), useViewportActions.ts:84
- scenario: `useActionSet(standardActions)` re-registers whenever an action's *identity* changes (`actionsKey = actions.map(identityOf)`), and its re-registration puts the kit's `viewport.touchZoom` back on top of the stack. `useViewportActions` re-registers its configured `touchZoom` only when `rev` changes, and `rev` is the joined *ids*. If an enabled preset change (or a rebuilt pool) swaps one action object for another under the same id, `useActionSet` reruns, `rev` stays the same, and `viewport={{ touchZoom: { min, max, axis } }}` silently reverts to the kit's 0.1–8 clamp. `rev` should be keyed the same way `useActionSet` is (identities).
- evidence: read (useActionSet.ts:96-117 keys on `identityOf`; inference about when objects change)
- severity: low

## The preview ghost draws a node under a hidden container, where the departure ghost and the scene paint do not
- where: packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts:136-143 (draw, roots loop)
- scenario: `useDepartureGhostLayer` checks `shownUnder(parent)`, skipping a ghost whose ancestor `hidesSubtree`; `usePreviewGhostLayer` checks `hidesSubtree` only on the previewed root and its own descendants, and `resolvePreviews` has no hidden check either (grep). A preview root under a hidden group, such as a layout reflow proposing poses for the children of a hidden container, paints a ghost of a subtree the scene does not draw, for as long as the gesture runs. The same question ("is this node shown under its ancestors") gets two answers in two ghost layers.
- evidence: read (inference on which gestures produce such roots)
- severity: low

## `selectionOptions.initial` seeds a swapped-in scene with the first render's ids
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53-62 (useSeed)
- scenario: `first = useRef(initial)` is captured once per canvas, but seeding runs "once per scene". Swap `scene` for a new empty scene with a new `selectionOptions.initial` and the new scene is seeded with the *original* ids. Those may not exist in it, or may name the wrong nodes. It should read the `initial` current when the scene changes.
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

<!-- done: 5 findings, files read: 45 -->
