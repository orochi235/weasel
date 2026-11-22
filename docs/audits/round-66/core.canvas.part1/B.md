# Audit round 66 — core.canvas.part1 findings

## Orphaned custom layers fall to the tail in declaration order, so a chain anchored among them comes out reversed
- where: packages/core/src/canvas/layerOrder.ts:121 (composeOrderedLayers, orphan loop)
- scenario: `layers={{ b: { layer: B, after: 'a' }, a: { layer: A, after: 'missing' } }}`. `a` dangles, so it and `b` (anchored to `a`) are both orphans. The orphan loop walks `allCustomKeys` in insertion order and pushes each layer directly instead of going through `emitChild`, which would emit an orphan's `after`/`before` children around it. Result: `[..., B, A]`, so B paints beneath the layer it declared itself `after`. Expected: A at the tail with B immediately after it (`[..., A, B]`), keeping the declared relative order the way the non-orphan path does. The same applies to `before` chains among orphans, and to the order between two orphans in a cycle.
- evidence: read
- severity: low

## sceneContentBounds counts the copies of a container inside a consumed (boolean-operand) subtree that the render walk never paints
- where: packages/core/src/canvas/contentBounds.ts:35 (sceneContentBounds, copies loop)
- scenario: a boolean group `B` (`consumesChildren: true`) has an operand child `G` with `copiesFromPose` (a symmetry/repeat group). `buildSceneTree` never visits `B`'s children (`children = node.consumesChildren === true ? [] : …`), so `G` and its copies paint nothing; only `B`'s result shows. The copies loop in `sceneContentBounds` goes over every node in `scene.nodes` and skips only `flags.hidden(node)` (own and ancestor `hidden`), never checking whether an ancestor consumes its children. So it pushes `carried(boxOf(G), m)` for each of G's copies, and zoom-to-fit or a minimap frame grows to cover operand copies that are not drawn. It should skip a node that has a `consumesChildren` ancestor, the way `shown`/`buildSceneTree` do by never reaching it.
- evidence: read (traced `buildSceneTree` line 210 and `nodeGates.hidden`, which tests `hidden` and layers only)
- severity: low

## GestureReason's tag stays put when the camera moves without a dispatcher notification
- where: packages/core/src/canvas/GestureReason.tsx:51-69 (GestureReason effect, `read`)
- scenario: a drag is in flight over something that refuses it, so the `reason` tag shows at `reason.at`, a world point placed through `viewRef.current`. The view then changes with no in-flight handle publishing: a programmatic `animateView`/`setView`, or a `<CanvasView>` camera following its outer view. `read` runs only from `dispatcher.subscribe` and from registry version changes, and nothing subscribes to the view (`subscribeView`), so the tag stays at the old client position, detached from the world point it names, until the next dispatcher notification (usually the next pointer move). Expected: it re-places on every view change, as the canvas layers do.
- evidence: read (inference that no dispatcher notification accompanies a programmatic view write; not run)
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
