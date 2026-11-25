## The `box` LOD rung memoizes its fill without the inherited paint, so a container's fill change leaves an inheriting child's box the old color
- where: packages/core/src/canvas/lod/lodBox.ts:34 (paintLodBox)
- scenario: a mark with `fill: 'inherit'` inside a group, zoomed out until it draws at the `box` rung. Change the group's `fill` (red → blue). The child node object and its `data` are unchanged, and `nodeMemo` keys only on node, slot, `pose`, `data` and `also` (core/scene/nodeMemo.ts:105); `also` is not passed, and `inherited` is read inside `derive`. The memo hits and the box stays red until the child's data or pose changes, or a painter registration bumps the memo generation. It should repaint blue, as the `full` rung does. Passing `inherited?.fill` (or `inherited`) as `also` keys it.
- evidence: read
- severity: medium

## `collapseRungs` caches one ladder per distinct `collapseBelowPx` forever
- where: packages/core/src/canvas/lod/lodWalk.ts:59,82 (byCollapse / collapseRungs)
- scenario: a host that drives `LodOptions.collapseBelowPx` from a continuous control (a slider, or a value derived from dpr or zoom) creates a new entry in the module-level `byCollapse` Map for every distinct number it passes. Nothing evicts them, so the Map grows for the life of the page. It should cap the cache or keep only the last value.
- evidence: read
- severity: low

## A node `lod` naming the same rung twice resolves `prev` to the first one, which breaks hysteresis
- where: packages/core/src/canvas/lod/lodWalk.ts:136 (createLodWalk → pick)
- scenario: `nodeLodRungs` maps every name it doesn't know to `'full'`, and a `lod` may legitimately list one rung id twice, e.g. `[{as:'full',fromPx:0},{as:'box',fromPx:10},{as:'full',fromPx:50}]`. The node shows index 2 (`full`) and then settles at 60 px, which is inside the dead band (50×0.67 … 50×1.5). `findIndex` on `'full'` returns 0 rather than 2, and `rungIndexAt` then climbs from 0 to index 1 and returns `box`. The node drops a rung inside its own hysteresis band. It should stay at `full`. The previous pick should be matched by index, or by the `LodPick` object, which `resolve` makes once per rung, not by rung id.
- evidence: read
- severity: low

## `fitted` reports the target box as the bounds on an axis where the geometry has no extent
- where: packages/core/src/canvas/insertPreviewExtent.ts:68-71 (fitted)
- scenario: a `line` preview that is vertical (its box has `width === 0`), given `lands` with `width > 0`. `sx` is 1, so the geometry only moves to `to.x` and keeps zero width. The returned `bounds` is nonetheless `to` verbatim, `to.width` wide. The module's stated contract is one answer to "how big is the thing", but the commit's geometry and the reported bounds now disagree on that axis. On an axis it does not scale, `bounds` should keep the geometry's width or height.
- evidence: read
- severity: low

## `satisfiesRange` reads an empty range (or an empty `||` alternative) as invalid where npm reads it as `*`
- where: packages/core/src/canvas/kitRequirements.ts:137 (satisfiesRange)
- scenario: a contribution declares `requires: { core: '' }`, or `'^1 || '`, both of which npm's grammar (the header says it follows npm's everyday subset) treats as matching any version. `if (alt === '') return null` makes `checkRequirements` report `reason: 'invalid-range'`, so a contribution npm would accept is flagged. An empty alternative should be read as `*`.
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

<!-- done: 5 findings, files read: 39 -->
