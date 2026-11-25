## The scene/live fit frames hidden descendants of a shown container
- where: packages/minimap/src/minimapMath.ts:80 (sceneLeafBounds, boxOf)
- scenario: a visible group holds a mark with `hidden: true`, or a mark on a layer with `visible: false`, far from the rest (x = 5000). `sceneContentBounds` prunes hidden nodes only at the roots it walks (and expands hidden containers), then calls `boxOf(group)`; `boxOf` recurses through `scene.childrenOf(id).map(boxOf)` with no hidden check, so the hidden child's box joins the union. The minimap zooms out to frame content the canvas never paints. It should skip hidden nodes and hidden-layer nodes at every depth, as the 2026-11 ruling ("the minimap's fit now leaves hidden nodes out") says; the only test (minimapMath.test.ts:186) hides a root, not a child.
- evidence: read
- severity: medium

## `<MinimapCanvas>`'s rootView reads the last-rendered `mainView`, so samples landing before a re-render overwrite each other
- where: packages/minimap/src/useMinimapInput.ts:44 (rootView.get), with packages/minimap/src/actions.ts:139 and :171
- scenario: `rootView.get()` returns `useLatest(mainView)`, which updates only after the host re-renders from `onMainViewChange`. A touch pinch delivers one pointermove per finger, back to back in the same frame, and React renders an update from a native event later, in a scheduler task. The first move sets `root.get() × f1`; the second reads the same stale view and sets `stale × f2`, while `spread` has already advanced past f1. The f1 step is lost, so the main view zooms less than the fingers spread (and likewise for two wheel samples in one frame). It should compound off the view it last set (hold the pending view until the prop catches up). The pinch and wheel tests wrap each event in `act()`, which forces a render between them, so they can't see this.
- evidence: read (event timing is inferred, not run)
- severity: medium

## A touch pinch that opens with both fingers on one point never zooms
- where: packages/minimap/src/actions.ts:167 (createMinimapTouchZoomAction onMove)
- scenario: `start` stores `spread = mt.spread`; when that is 0, every `onMove` returns at `!(spread > 0)` before `spread = p.currentSpread` runs, so `spread` stays 0 for the whole gesture and no later move zooms, however far the fingers part. It should take the first positive spread as the base and zoom from there.
- evidence: read
- severity: low

## `<MinimapCanvas layerVisibility>` hides a layer but the fit still frames it
- where: packages/minimap/src/MinimapCanvas.tsx:122 (useFitView call), packages/minimap/src/minimapMath.ts:120
- scenario: pass `layerVisibility={{ 'scene:annotations': false }}`, the main canvas's map, with an annotation far from the content. The minimap paints without it, but `computeFitView` reads only the scene's own layer flags, so the minimap still zooms out to frame the hidden annotation. The prop's doc says it hides scene layers "so both show the same set"; the fit should leave out what `layerVisibility` hides.
- evidence: read
- severity: low

## Files read
packages/minimap/src/MinimapCanvas.tsx
packages/minimap/src/actionParamSchema.ts
packages/minimap/src/actions.ts
packages/minimap/src/createMinimapContribution.ts
packages/minimap/src/index.ts
packages/minimap/src/layers.ts
packages/minimap/src/minimapMath.ts
packages/minimap/src/pbt.fixture.ts
packages/minimap/src/useFitView.ts
packages/minimap/src/useMinimapInput.ts
<!-- done: 4 findings, files read: 10 -->
