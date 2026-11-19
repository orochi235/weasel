I couldn't write `.skulk/out/findings.md` because the write permission was declined. As the brief says, the whole findings document is below instead.

# Audit round 39: core.canvas.part1

## `sceneContentBounds` drops the visible subtree of a root that sits on a hidden layer
- where: packages/core/src/canvas/contentBounds.ts:27 and :29 (`sceneContentBounds`)
- scenario: a root group's `layer` is hidden, and its children are on visible layers. `buildSceneTree` paints those children: a hidden layer only takes away the node's own bucket, and `visit` still walks its children, as `nodeGates` says ("A layer hides only the nodes tagged to it"). But `gates.hidden(root)` is true because of the root's layer, so the root's whole box is skipped. The children don't count toward zoom-to-fit or the minimap, and the content can be framed off-screen. Line 29 has the same problem: a container with `copiesFromPose` on a hidden layer has its copies skipped, yet `buildSceneTree` visits its children's copies whatever the container's bucket is. Only `hidesSubtree` (`node.hidden`) should prune a subtree here; a hidden layer should only take out the node's own paint.
- evidence: read (contentBounds.ts:27-33; buildSceneTree.ts:137-186; core/scene/nodeGates.ts:127-135; docs/unruled.md:1572 rules out hidden nodes, not visible children under a hidden-layer root)
- severity: medium

## A gesture refused inside a `<CanvasView>` never shows its reason
- where: packages/core/src/canvas/GestureReason.tsx:31-45; mounted at packages/core/src/canvas/SceneCanvas.tsx:163
- scenario: a move dragged over a refusing target inside a `<CanvasView>` (a PiP or a minimap panel) publishes a `reason` overlay (editing/src/actions/move/refusal.ts:21). That happens on the view's own dispatcher (`useViewDispatcher`, CanvasView.tsx:152). `<GestureReason>` subscribes only to the surface's dispatcher and converts `reason.at` with the surface's `viewRef`, so no tag appears. The view's canvas-painted overlays do show, because they are read per view through `gestureOverlaysFrom(data)`. So the same refusal is answered one way on the surface and another way in a view. Even if the reason were read, it would be placed through the wrong camera.
- evidence: read
- severity: low

## `~*` / `~x` / `~` limit a requirement to `<1.0.0` instead of matching any version
- where: packages/core/src/canvas/kitRequirements.ts:104-106 (`parseComparator`, case `'~'`)
- scenario: `checkRequirements({ core: '~*' })` against core 1.4.0. `nums` is empty, so `M = 0` and `top = v(M + 1, 0, 0)` = 1.0.0. The comparators become `>=0.0.0 <1.0.0` and the result is `'unsatisfied'`. npm reads `~*` as `*`, and the `^` branch beside it already returns `[]` (any) for an empty partial. The `'~'` case needs the same `nums.length === 0 → []`.
- evidence: read
- severity: low

## `inkBoxes` measures group members at their shown (overridden) poses, while everything else comes from the document
- where: packages/core/src/canvas/inkBoxes.ts:23 (`inkBoxes`, `worldPoseOf`)
- scenario: an action calls `drawnBoxes(deps)` without its own `frame` while a pose override is live on a group member. `scene` is `drawnBoundsScene(documentOf(deps.scene))`, so the group's node, derived paths and inherited paint come from the document. But `worldPoseOf` falls back to `scenePoseFrame(deps.scene!)`, the shown scene, whose `effectivePose` reads overrides. `membersExtents` then boxes the group around where the gesture shows the member, not where the document holds it, which contradicts the comment on line 16. The fallback should be `scenePoseFrame(documentOf(deps.scene))`.
- evidence: read (inkBoxes.ts:17 vs :23; interactions/actions/poseFrame.ts:80-95; core/scene/documentOf.ts)
- severity: low

## `defaultDrawOne` places a label at (NaN, NaN) on a node whose pose has no `x`/`y`
- where: packages/core/src/canvas/defaultDrawOne.ts:45-51 (`defaultDrawOne`)
- scenario: a node with a non-rect `Path` pose (painted by `kit:path-pose`) and a `data.label`. The pose is cast to `{ x, y }`, so `p.x + 6` and `p.y + 14` are NaN, and the text command is emitted at NaN. The label should be anchored on the pose's box (`boundsOfPath` / the descriptor) rather than raw `x`/`y`.
- evidence: read
- severity: low

## Files read
packages/core/src/canvas/Canvas.tsx
packages/core/src/canvas/CanvasView.tsx
packages/core/src/canvas/CursorCoordsHud.tsx
packages/core/src/canvas/DrawCanvas.tsx
packages/core/src/canvas/GestureReason.module.css
packages/core/src/canvas/GestureReason.tsx
packages/core/src/canvas/ModalityHud.tsx
packages/core/src/canvas/NodeShape.ts
packages/core/src/canvas/PickHud.tsx
packages/core/src/canvas/SceneCanvas.tsx
packages/core/src/canvas/SceneViewCanvas.tsx
packages/core/src/canvas/SurfaceCanvas.tsx
packages/core/src/canvas/ViewMarker.tsx
packages/core/src/canvas/accentColor.ts
packages/core/src/canvas/adapterDerivedPath.ts
packages/core/src/canvas/adapterPickSource.ts
packages/core/src/canvas/affordanceAt.ts
packages/core/src/canvas/ambientContributions.tsx
packages/core/src/canvas/bestHitPicker.ts
packages/core/src/canvas/buildSceneLayer.ts
packages/core/src/canvas/buildSceneTree.ts
packages/core/src/canvas/canvasBackend.ts
packages/core/src/canvas/canvasBackendContext.ts
packages/core/src/canvas/canvasExtension.ts
packages/core/src/canvas/canvasProps.ts
packages/core/src/canvas/canvasRenderer.ts
packages/core/src/canvas/canvasViewProps.ts
packages/core/src/canvas/centersBetween.ts
packages/core/src/canvas/commandRasterizer.ts
packages/core/src/canvas/contentBounds.ts
packages/core/src/canvas/contextAttributes.ts
packages/core/src/canvas/copiesAbove.ts
packages/core/src/canvas/defaultDrawOne.ts
packages/core/src/canvas/derivedPath.ts
packages/core/src/canvas/devtoolsLabel.tsx
packages/core/src/canvas/doubleClickTarget.ts
packages/core/src/canvas/drawEnvelope.ts
packages/core/src/canvas/drawnBounds.ts
packages/core/src/canvas/gestureBounds.ts
packages/core/src/canvas/hostAnchor.ts
packages/core/src/canvas/hud.module.css
packages/core/src/canvas/inheritedPaints.ts
packages/core/src/canvas/inkBoxes.ts
packages/core/src/canvas/insertPreviewExtent.ts
packages/core/src/canvas/kitRequirements.ts
packages/core/src/canvas/layerHover.ts
packages/core/src/canvas/layerOrder.ts

<!-- done: 5 findings, files read: 47 -->