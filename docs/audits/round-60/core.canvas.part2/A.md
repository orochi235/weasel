The findings file couldn't be written (permission to write `.skulkr/out/findings.md` was denied), so the whole document is below. One more thing: commit `deaf03bd…` doesn't exist in this checkout, which is at `6f634fabe1`. None of the listed files have uncommitted changes, so this review is of that commit.

# Findings: core.canvas.part2 (round 60)

## A node moved into a wide container with its box unchanged never gets into that container's BVH
- where: packages/core/src/canvas/reach/reachBoxes.ts:77 (ReachBoxes.drain), with reach/reachTree.ts:102-123 (Tree.apply) and reachBoxes.ts:97-114 (fitWide)
- scenario: A container already has at least `WIDE_AT` (64) children, so they are indexed in a `WideChildren` BVH. A `kit:move` then reparents a node into it and keeps the node's world box, as dragging into a group or frame does.
  - `apply` drops the record from the old parent's `wide`, sets `rec.parent` to the new container and enqueues it.
  - In `drain`, `recompute(rec)` reads back the same own box, so reach and tags are unchanged and it returns false. The `continue` then skips `rec.parent.wide?.put(rec)`.
  - The new parent's `recompute` → `fitWide` only loads the BVH when `wide` was null, so the existing index never gets the child.
  - `childrenMeeting` answers from `wide.meeting`, so the moved node is left out of every `collect` and `childrenMeeting` (pick-index candidates, the pruned render walk) until a full rebuild. It can't be picked and gets culled from the paint.
  - Fix: a record that joined a parent should be `put` into that parent's `wide` whether or not its own reach moved.
- evidence: read
- severity: high

## `RasterSession.renderIds` drops the plan's `screen` matrix that `render` uses
- where: packages/core/src/canvas/renderSceneToPixels.ts:320 (createRasterSession → renderIds)
- scenario: Call `renderIds` with `pixelRatio: 2` and no `screen`. `planPixelRender` returns `plan.screen = scale(2)`, and `render` and `renderPlan` pass `args.screen ?? plan.screen`. `renderIds` passes `args.screen` only, so `'screen'`-unit paint is measured at 1 output px per CSS px. The id frame then disagrees with the pixels `render` makes for the same args. It should pass `args.screen ?? plan.screen`.
- evidence: read
- severity: medium

## The visibility-index cache grows by one entry per new `paintBounds` / `toPose` function, without bound
- where: packages/core/src/canvas/reach/sceneVisibility.ts:143-154 (INDEXES, visibilityOf)
- scenario: The per-scene table is a `Map` keyed by the `paintBounds` function's identity, then by `toPose`'s, and nothing ever evicts an entry. Both come straight from callers: `sceneSlotWiring.ts:71` passes `slot.paintBounds` / `slot.toPose`, and `sceneViewRender.ts:197,227` passes `args.paintBounds`.
  - Two cases add an entry on every call: a `<SceneCanvas>` whose `layers.scene.paintBounds` is an inline arrow (a new function each render), and `renderSceneToCanvas` called repeatedly with an inline `paintBounds`.
  - Each entry is a new `SceneVisibility` that builds up to `OCTAVES_KEPT` whole-scene reach trees. Memory grows for the scene's lifetime, and every paint pays a full build.
  - Fix: cap the table, for example by keeping only the latest entry per slot.
- evidence: read
- severity: medium

## Pasting onto a page keeps each root's copied layer, so it throws when that layer is below the page's
- where: packages/core/src/canvas/sceneClipboard.ts:283 (pasteSceneSnapshot)
- scenario: Roots get `into.layer` only when `landing` names a container. When `pasteOnPages` puts them on a page (`paged`), their parent becomes the page node but `layer` stays `item.layer`. The insert path (`siteIn`) puts a node on its parent's layer, and the scene refuses a child below its parent's layer (`layerStack.ts:93`).
  - Example: a scene whose pages are created with `layer: 'main'` (`pageNodes.ts:195` allows any layer).
  - Copy a node from the lower `'back'` layer and paste it.
  - Its InsertOp throws "a child may not render below its parent's layer", where an insert at the same point lands on the page's layer.
  - Fix: a paged root should take `paged.get(id).site.layer`, the same way the `into` branch takes `into.layer`.
- evidence: read
- severity: low

## Files read
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
packages/core/src/canvas/pressTarget.ts
packages/core/src/canvas/publishPreviews.ts
packages/core/src/canvas/rasterReadback.ts
packages/core/src/canvas/rasterToPng.ts
packages/core/src/canvas/reach/boxes2d.ts
packages/core/src/canvas/reach/reachBoxes.ts
packages/core/src/canvas/reach/reachRec.ts
packages/core/src/canvas/reach/reachRegion.ts
packages/core/src/canvas/reach/reachTree.ts
packages/core/src/canvas/reach/reachTypes.ts
packages/core/src/canvas/reach/sceneVisibility.ts
packages/core/src/canvas/reach/wideChildren.ts
packages/core/src/canvas/readCanvasPixels.ts
packages/core/src/canvas/readback.ts
packages/core/src/canvas/registerShaders.ts
packages/core/src/canvas/renderDebugSnapshot.ts
packages/core/src/canvas/renderDiagnostics.ts
packages/core/src/canvas/renderNeeds.ts
packages/core/src/canvas/renderSceneToPixels.ts
packages/core/src/canvas/renderSceneToPixelsTypes.ts
packages/core/src/canvas/sceneAdapter.ts
packages/core/src/canvas/sceneClipboard.ts
packages/core/src/canvas/sceneLayerPaint.ts
packages/core/src/canvas/scenePickIds.ts
packages/core/src/canvas/scenePickReads.ts
packages/core/src/canvas/scenePickSource.ts

<!-- done: 4 findings, files read: 50 -->