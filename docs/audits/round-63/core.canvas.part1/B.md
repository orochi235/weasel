# Findings: core.canvas.part1 (round 63)

Reviewed at HEAD 6f634fabe1; the frozen commit 1b4edb3a is not in this clone and the listed files are unmodified in the working tree.

## A group's drawn box reaches over members that are hidden or consumed, which nothing paints
- where: packages/core/src/canvas/drawnBounds.ts:82 (inkExtentsOf → membersExtents)
- scenario: a group holds a child with `hidden: true` (or a node with `consumesChildren`, whose children are operands, not paint) placed outside the group's own pose box. `inkExtentsOf` takes `scene.childrenOf(id)` whole and grows the box over every member's drawn box, so selection chrome, resize, rotate and alignment sit on a box that reaches over the invisible child. `buildSceneTree` (buildSceneTree.ts:171, :210) and `adapterPickSource` (:54, :59) prune both cases: the paint, the pick and the chrome answer the same question three ways. Should skip members `hidesSubtree` holds for, and every member of a node that consumes its children.
- evidence: read
- severity: medium

## defaultPaintBounds bounds a labeled group without its label when a consumer painter claiming groups sets drawsLabel
- where: packages/core/src/canvas/defaultDrawOne.ts:96 (defaultPaintBounds) vs :38/:46 (defaultDrawOne)
- scenario: a consumer registers a painter whose `matches` accepts group nodes and sets `drawsLabel: true`. `defaultDrawOne` never asks a painter for a group (`painter` is undefined), so it draws `data.label` at pose.x+6, pose.y+14 as an over-children text command. `defaultPaintBounds` asks `findNodeShape` without the group exception, sees `drawsLabel`, and returns `groupBoxBounds` instead of `null`. With `cull` on, a group whose box has left the view while its label (which can be wider than a small box) still shows is culled, and the label vanishes early. The two functions should ask the same "does a painter draw this label" question.
- evidence: read
- severity: low

## End-anchored HUDs are pinned against the window's width including its scrollbar
- where: packages/core/src/canvas/hostAnchor.ts:66 (hostAnchorCss), fed by useHostAnchor.ts:56
- scenario: the page shows a classic vertical scrollbar (Windows/Linux, or macOS set to always show scrollbars), and a `CursorCoordsHud` / `PickHud` / `ModalityHud` is aligned `x: 'end'`. Its only caller passes `window.innerWidth` as the viewport, which includes the scrollbar, and `hostAnchorCss` writes `right: viewport.width - rect.x - rect.width`. A `position: fixed` element's `right` is measured from the layout viewport (`documentElement.clientWidth`), which excludes the scrollbar, so the HUD lands one scrollbar width (~15 px) left of the corner it was asked for. The clamp in `hostAnchorRect` also lets a panel sit under the scrollbar. The same applies vertically to `bottom` with a horizontal scrollbar. The viewport should be the layout viewport's size, or the rect should be pinned by `left`/`top` only.
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
packages/core/src/canvas/layerSample.ts
packages/core/src/canvas/layerSlots.ts
packages/core/src/canvas/mountedCanvases.ts

<!-- done: 3 findings, files read: 50 -->
