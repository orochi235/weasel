# Audit round 67 — ui.components.CurveEditor

## CurveEditor's own layer takes the id `'function'`, the default id of a child `FunctionLayer`, so arrow keys on a child's anchor move CurveEditor's anchor instead
- where: packages/ui/src/components/CurveEditor/CurveEditor.tsx:137 (CurveEditor), with createFunctionLayer.tsx:41,136 (onKeyDown) and layerMarks.ts:7 (keyTargetIn)
- scenario: `<CurveEditor value={a} …><FunctionLayer state={b} onInput={…} /></CurveEditor>`, which CurveEditor's `children` doc invites ("or more layers"). The child takes the default id `'function'`, so both groups are `data-layer-id="function"`. Focus anchor 1 of the child layer and press ArrowUp: `dispatchKey` asks the top layer (CurveEditor's) first, and `keyTargetIn(e, 'function')` matches the child's mark too. The top layer then reads `data-anchor-index="1"` and nudges *its own* anchor 1, calls `preventDefault`, and the child layer is never asked. The child's anchor should move; the CurveEditor curve moves instead. A stylesheet selecting `[data-layer-id='function']` styles both layers as well. CurveEditor should not reserve the default id, or should give its layer one a child cannot take by default.
- evidence: read
- severity: medium

## On a strict (`constrain: 'function'`) layer, dragging an anchor whose neighbors are closer than two gaps pushes it past a neighbor
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:83-86 (withAnchorMoved)
- scenario: `left = prev.x + ε` and `right = next.x − ε`, then `nx = max(left, min(right, nx))`. When `left > right` this yields `left`, which can lie past `next.x`. One case is a consumer value with repeated x, such as a step `[{x:0},{x:0.5},{x:0.5},{x:0.5},{x:1}]` on xRange [0,1], where ε = 0.001. Dragging index 2 gives left = 0.501 and right = 0.499, so the anchor lands at x = 0.501, past index 3 at 0.5. Another case is a range or `xClamp` change that grows ε: RimContour's bevel `xClamp` follows the seam. Either way the "function" curve's anchors leave x order, and the monotone spline is drawn through unsorted x. The move should stay between its neighbors: hold the anchor still, or clamp to the neighbors without the gap.
- evidence: read
- severity: low

## The keyframe layer's default `formatX` rounds to an integer, so on the default [0, 1] range every key and segment gets the same accessible name
- where: packages/ui/src/components/CurveEditor/createKeyframeLayer.tsx:71 (createKeyframeLayer)
- scenario: `<LayeredCurveEditor>` uses the default xRange [0, 1]. A `<KeyframeLayer>` there with keys at t = 0, 0.3, 0.6, 1 names them "Curve key at 0", "Curve key at 0", "Curve key at 1" and "Curve key at 1". Its segments are "Curve segment into 0", "…into 1" and "…into 1". A screen-reader user cannot tell the marks apart. The function layer formats with `decimal({ maxPlaces: 3 })` (functionMarks.tsx:29), so the two layers answer "how is a coordinate spoken" two ways. The default should keep the precision the range needs.
- evidence: read
- severity: low

## With `history={false}` the plot leaves the tab order, so keys a layer handles at the editor's own focus never arrive
- where: packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx:174 (LayeredCurveEditor)
- scenario: `tabIndex={historyEnabled ? hold.tabIndex(0) : undefined}`. `CurveLayer.onKeyDown` is documented to run "while focus is on the editor or on anything a layer rendered into it" (layerTypes.ts:127). A `CustomLayer` handling, say, Delete on its selection with the plot focused works with history on. A consumer that turns `history` off because it keeps its own undo, as the `history` doc tells it to, can no longer focus the plot, so that layer's keyboard path is gone. Focusability should not hinge on the undo option.
- evidence: read
- severity: low

## A `'pinned-x'` endpoint is styled as immovable (gray fill, `cursor: default`), though it drags in y
- where: packages/ui/src/components/CurveEditor/functionMarks.tsx:62,89 (anchorMarks), with CurveEditor.module.css:62-65 (`.anchor.pinned`)
- scenario: `isPinnedEndpointAt` is true for both `'pinned-x'` and `'pinned-both'`, and `(pinned || locked) && s.pinned` gives both the same class. `.anchor.pinned` paints the locked gray and sets `cursor: default`. A `'pinned-x'` endpoint still drags and nudges in y: `withAnchorMoved` frees its y, and `canAnchorMove` gives it a tab stop. `hideNonInteractive` keeps it on screen for exactly that reason ("A 'pinned-x' endpoint still moves in y, so it stays", functionLayerTypes.ts:74). So on the PinnedX story the endpoints look and point like locked ones but move when dragged. "Can this anchor be moved" gets two answers: the movement rules say yes, the styling says no. The class should follow `canAnchorMove`.
- evidence: read
- severity: low

## A long press, one of the documented context-menu gestures, cannot delete a function-layer anchor: its pointerdown already started a drag, so the editor drops the contextmenu event
- where: packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx:150 (onSvgContextMenu), with createFunctionLayer.tsx:94-103 (onPointerDown)
- scenario: `CurveLayer.onContextMenu` is documented for "a right-click, a long press, the menu key" (layerTypes.ts:102). A touch long press on an anchor fires a primary pointerdown first. `isPrimaryPress` passes, `grab` starts the anchor drag, and the gesture is active. When the long-press `contextmenu` arrives, `onSvgContextMenu` returns at `if (busy()) return;` without asking the layer and without `preventDefault`. The anchor is not deleted, and the browser's own menu or callout is left to open. A right-click works only because button 2 is not a primary press.
- evidence: inference (from reading the handlers; not run on a touch device)
- severity: low

## Files read
packages/ui/src/components/CurveEditor/CurveEditor.module.css
packages/ui/src/components/CurveEditor/CurveEditor.pointPlotter.stories.tsx
packages/ui/src/components/CurveEditor/CurveEditor.stories.tsx
packages/ui/src/components/CurveEditor/CurveEditor.tsx
packages/ui/src/components/CurveEditor/CurveFill.tsx
packages/ui/src/components/CurveEditor/CustomLayer.tsx
packages/ui/src/components/CurveEditor/Diamond.tsx
packages/ui/src/components/CurveEditor/FunctionLayer.tsx
packages/ui/src/components/CurveEditor/KeyframeLayer.tsx
packages/ui/src/components/CurveEditor/LayeredCurveEditor.stories.module.css
packages/ui/src/components/CurveEditor/LayeredCurveEditor.stories.tsx
packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx
packages/ui/src/components/CurveEditor/anchorRules.ts
packages/ui/src/components/CurveEditor/createFunctionLayer.tsx
packages/ui/src/components/CurveEditor/createKeyframeLayer.tsx
packages/ui/src/components/CurveEditor/functionAnchorEdits.ts
packages/ui/src/components/CurveEditor/functionCurve.ts
packages/ui/src/components/CurveEditor/functionLayerTypes.ts
packages/ui/src/components/CurveEditor/functionMarks.tsx
packages/ui/src/components/CurveEditor/hitTest.ts
packages/ui/src/components/CurveEditor/index.ts
packages/ui/src/components/CurveEditor/keyframeCurve.ts
packages/ui/src/components/CurveEditor/keyframeEdits.ts
packages/ui/src/components/CurveEditor/keyframeMarks.tsx
packages/ui/src/components/CurveEditor/layerCtx.ts
packages/ui/src/components/CurveEditor/layerDispatch.ts
packages/ui/src/components/CurveEditor/layerHost.ts
packages/ui/src/components/CurveEditor/layerMarks.ts
packages/ui/src/components/CurveEditor/layerTypes.ts
packages/ui/src/components/CurveEditor/presets.ts
packages/ui/src/components/CurveEditor/setCurveOp.ts
packages/ui/src/components/CurveEditor/useLayerGesture.ts
packages/ui/src/components/CurveEditor/useLayerHistory.ts

<!-- done: 6 findings, files read: 33 -->
