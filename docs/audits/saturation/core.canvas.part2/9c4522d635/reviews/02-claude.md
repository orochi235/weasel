# Findings: core.canvas.part2

## A fitted insert extent reports `lands`' full size on an axis its geometry has no extent on
- where: packages/core/src/canvas/insertPreviewExtent.ts:64 (fitted)
- scenario: a horizontal `line` (or a one-sample/collinear `pencil`) whose made bounds have height 0, fitted to `lands` with height 20: `sy = 1`, so the geometry lies on `y = to.y` with zero height, but `bounds` is returned as `{ ...to }` with height 20. The module is "the one answer" to the extent shared by preview, commit and reported bounds, and here the bounds and the geometry disagree (the geometry also sits on the box's top edge, not inside it). Expected: on an axis with no extent, bounds keep the geometry's extent (0) at the moved position.
- evidence: read
- severity: low

## `collapsedAbove` documented as the nearest collapsed ancestor, implemented as the outermost
- where: packages/core/src/canvas/lod/lodState.ts:17 (LodState.collapsedAbove), :50 (createLodState)
- scenario: ancestors `[inner, outer]`, both drawn at a skipping rung: the interface says it returns the nearest (`inner`), the implementation walks from the end and returns `outer`. A caller reading the doc and using the id (e.g. to redirect a pick to the group that answers for the node) gets the other group. pickWalk only tests `!== null`, so it is unaffected today; the contract is answered two ways.
- evidence: read
- severity: low

## `after: ''` is an anchor to the both-anchors check but no anchor to placement
- where: packages/core/src/canvas/layerOrder.ts:47 (composeOrderedLayers)
- scenario: `{ layer, after: '', before: 'grid' }` throws "sets both after and before" (checked with `!== undefined`), although placement reads `after` by truthiness and would have anchored it before `grid`; `{ layer, after: '' }` silently goes to the tail with no warning, while any other unknown anchor warns as dangling. The two checks answer "does it have an anchor" differently.
- evidence: read
- severity: low

## The default registry's id-conflict check does not see the built-ins it holds
- where: packages/core/src/canvas/nodeShapeRegistry.ts:122 (createNodeShapes → register)
- scenario: `defaultNodeShapes.register({ id: 'kit:image', ... })` (or `registerNodeShape` with a built-in's id) neither throws nor, with `replace: true`, displaces the built-in: `held` filters only `tiers.high`/`tiers.normal`, while `entries()` of the same registry lists the built-ins. Two painters under one id then coexist and the doc's "a different painter under an id this registry already holds throws, unless `opts.replace`" is false for built-in ids; `replace` (hot-reload of an override) leaves the old built-in in place.
- evidence: read
- severity: low

## `byCollapse` caches a ladder per distinct `collapseBelowPx` with no bound
- where: packages/core/src/canvas/lod/lodWalk.ts:59, :79 (collapseRungs)
- scenario: a consumer driving `LodOptions.collapseBelowPx` from a continuous control (a slider, or a value derived from dpr/zoom) adds a module-level entry for every distinct number ever passed; nothing evicts them for the life of the page.
- evidence: read
- severity: low

## `checkPixelRenderRect`'s doc says it imports nothing, but it imports `@weasel-js/registry`
- where: packages/core/src/canvas/pixelRenderRect.ts:1
- scenario: the doc promises a Node caller can reach it through `@weasel-js/core/math` because it imports nothing; it imports `isFiniteNumber` from `@weasel-js/registry`, so that subpath now pulls in the registry package (and whatever it loads) — the stated reason the function is safe to reach from Node no longer holds as written.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/hostAnchor.ts
packages/core/src/canvas/hud.module.css
packages/core/src/canvas/inheritedPaints.ts
packages/core/src/canvas/inkBoxes.ts
packages/core/src/canvas/insertPreviewExtent.ts
packages/core/src/canvas/kitRequirements.ts
packages/core/src/canvas/layerHover.ts
packages/core/src/canvas/layerOrder.ts
packages/core/src/canvas/layerSample.ts
packages/core/src/canvas/layerSlots.ts
packages/core/src/canvas/lod/ladder.ts
packages/core/src/canvas/lod/lodBox.ts
packages/core/src/canvas/lod/lodState.ts
packages/core/src/canvas/lod/lodWalk.ts
packages/core/src/canvas/mountedCanvases.ts
packages/core/src/canvas/nodeOutline.ts
packages/core/src/canvas/nodeShapeRegistry.ts
packages/core/src/canvas/nodeShapeTypes.ts
packages/core/src/canvas/overChildren.ts
packages/core/src/canvas/overlayRoleStrokes.ts
packages/core/src/canvas/ownClip.ts
packages/core/src/canvas/paintCull.ts
packages/core/src/canvas/paintOverrides.ts
packages/core/src/canvas/paintStandIns.ts
packages/core/src/canvas/paintedCursorLayer.ts
packages/core/src/canvas/pasteOnPages.ts
packages/core/src/canvas/pasteShape.ts
packages/core/src/canvas/pathOverlay.ts
packages/core/src/canvas/pbt.fixture.ts
packages/core/src/canvas/pickIndex/nodeBroadBox.ts
packages/core/src/canvas/pickIndex/pickIndexFixture.ts
packages/core/src/canvas/pickIndex/scenePickIndex.ts
packages/core/src/canvas/pickReach.ts
packages/core/src/canvas/pickWalk.ts
packages/core/src/canvas/pixelPick.ts
packages/core/src/canvas/pixelRenderRect.ts
packages/core/src/canvas/pixelScale.ts
packages/core/src/canvas/planeClips.ts
packages/core/src/canvas/poseRotation.ts

<!-- done: 6 findings, files read: 39 -->
