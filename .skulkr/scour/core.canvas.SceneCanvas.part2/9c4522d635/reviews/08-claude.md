## `<SceneCanvas>` never passes a style to its dispatcher-overlay layer, so `DispatcherOverlayStyle` (incl. `roles`) cannot reach the canvas's marquee/lasso/polyline paint
- where: packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts:131 (useSceneCanvasLayers), :182
- scenario: the changelog for the removal of `ConnectActionOptions.stroke` tells consumers "`DispatcherOverlayStyle.roles` is where a consumer restyles one" (restyle `connector`/`cut`). On a `<SceneCanvas>`, the layer is built as `useDispatcherOverlayLayer({ dispatcher })` with no `style`, and the `dispatcherOverlay` slot is then written unconditionally over anything `builtLayersOf(merged)` produced, so no prop (layers slot or otherwise) reaches it. A diagram consumer wanting a different connector stroke, or any consumer restyling the marquee fill, has no path; they always get `DEFAULT_STYLE` / `OVERLAY_ROLE_STROKES`. Expected: a `layers.dispatcherOverlay` config (or similar) forwarded as `style`.
- evidence: read (grep: the only non-test caller is this line; no `dispatcherOverlay` slot is read from `merged`)
- severity: medium

## A style field passed as `undefined` erases the overlay default instead of falling back to it
- where: packages/core/src/canvas/SceneCanvas/useDispatcherOverlayLayer.ts:85 (draw)
- scenario: `useDispatcherOverlayLayer({ dispatcher, style: { fill: theme.fill } })` with `theme.fill` undefined → `{ ...DEFAULT_STYLE, ...style }` sets `cfg.fill = undefined`, and the marquee/lasso emit `fill: { paint: { color: undefined } }` (same for `stroke`, `dash`, `lineWidth`). Expected: an absent value keeps the default, as the role merge's `getOwn ?? fallback` does.
- evidence: read
- severity: low

## Re-registering the standard actions with the same ids leaves a configured pinch zoom buried under the kit default
- where: packages/core/src/canvas/SceneCanvas/useSceneStandardActions.ts:150 (useSceneStandardActions → useViewportActions `rev`)
- scenario: `useActionSet(standardActions)` re-runs its effect when `actions.map(identityOf)` changes, that is, when any action object's identity changes. `rev` passed to `useViewportActions` is `standardActions.map(a => a.id).join('|')`, ids only. If the set is rebuilt with a new descriptor object under an unchanged id (for example a preset or `enabled` change that rebuilds the same ids), the kit's `viewport.touchZoom` is pushed back on top of the registry stack while `rev` is unchanged, so `useViewportActions` does not re-register the configured `viewport.touchZoom` ({ min, max, axis }) over it. The canvas then pinches with the kit's 0.1–8 clamp, ignoring `viewport.touchZoom`. Expected: `rev` keyed the way `useActionSet` keys its effect.
- evidence: read (useActionSet.ts:103 keys on `identityOf`). Whether a real preset change produces new same-id objects is inferred, not reproduced.
- severity: low

## A scene swapped in later is seeded with the first render's `selectionOptions.initial`, not the current one
- where: packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53 (useSeed)
- scenario: `first = useRef(initial)` is never updated, but the effect re-seeds once per new `scene`. Swapping `scene={b}` together with `selectionOptions={{ initial: ['b1'] }}` seeds `b` with the ids from the very first scene (`['a1']`), which `b` may not hold, instead of `['b1']`. Expected: seed a new scene with the `initial` current at the swap.
- evidence: read
- severity: low

## A removed node inside a container that draws copies leaves only one departure ghost; the preview ghost draws one per copy
- where: packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:93 (draw)
- scenario: `usePreviewGhostLayer` pushes the ghost again for every `copiesAbove(sc, root.node.id, paintedPose)` transform, so that "the copies [don't] vanish". The departure layer has no such step. When `poseTransition.exit` glides out a node removed from under a repeating/copying group, its copies vanish at once and only the original fades out. The question of where a node's ghost draws gets two different answers.
- evidence: read (inferred from comparing the two layers; not run)
- severity: low

## A preset's own tool that "inserts nothing" stays mounted when `defaultTools` or `tools.<id>=true` also names it
- where: packages/core/src/canvas/SceneCanvas/toolRegistry.ts:55-67 (resolveToolRegistry)
- scenario: when `args.offered` holds an own tool's id (the winner from `usePresetBuilds`), the first loop already `setOwn`s it if `defaultTools` includes the id or the patch says `true`. The own-tool loop then hits `insertsNothing` and `continue`s without removing the entry, so the tool the doc says "is left out, so it cannot be chosen" is mounted anyway (its dev warning is still printed). Expected: the unbuildable check also drops an entry the first loop placed.
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

<!-- done: 6 findings, files read: 45 -->
