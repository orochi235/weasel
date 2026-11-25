## A `box` LOD rung keeps the fill it inherited when it was first drawn, after its container's fill changes
- where: packages/core/src/canvas/lod/lodBox.ts:33 (paintLodBox)
- scenario: a mark with `fill: 'inherit'` (or a group whose `fill` resolves through `inherited`) is drawn at the `box` rung; its parent's fill is then edited from red to blue. The child node object, its pose and its data are unchanged, so `nodeMemo(node, SLOT, pose, …)` hits (it keys on node, pose, `node.data` and the memo generation, and `inherited` is not passed as `also`) and the box keeps painting red. It should paint blue, as the `full` rung does. Fix: pass `inherited?.fill` (or `inherited`) as nodeMemo's `also` argument.
- evidence: read (nodeMemo.ts:86–116 compares pose, data, also only)
- severity: medium

## The `collapseBelowPx` resolution cache is a module-level Map with no bound
- where: packages/core/src/canvas/lod/lodWalk.ts:59,77 (byCollapse / collapseRungs)
- scenario: a host that computes `options.collapseBelowPx` from a continuous value (dpr times a CSS length, a slider, a zoom-dependent rule) passes a new number per frame; each one adds a permanent `Resolved` entry to `byCollapse`, which is never pruned for the life of the page. Should be bounded (one slot, or a small LRU) or held per option object.
- evidence: read
- severity: low

## A node `lod` naming an unknown rung twice-maps to `full`, and hysteresis then reads back the wrong rung
- where: packages/core/src/canvas/lod/lodWalk.ts:68-70 (nodeLodRungs) and :137 (pick, `findIndex` on rung id)
- scenario: `lod: [{as:'none',fromPx:0},{as:'tpyo',fromPx:10},{as:'box',fromPx:20},{as:'full',fromPx:40}]`. The unknown name becomes a second `full` pick at index 1. A node held at 50 device px shows `full` (index 3) on a fresh walk; the next frame `prev` is found by rung id, so `findIndex` returns 1, and from index 1 `rungIndexAt` needs 20×1.5=30 to reach `box` and 40×1.5=60 for `full`, so at an unchanged 50 px the node drops to `box` and stays there. The rung flips with no zoom change. The previous pick should be found by index (or by pick object identity, which `r.picks[i]` gives), not by id.
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

<!-- done: 3 findings, files read: 39 -->
