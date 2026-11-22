# Audit round 67 — ui.components.CurveEditor

## A `'pinned-x'` endpoint, which still drags in y, is styled as immovable: gray fill, `cursor: default`, and no active look while dragged
- where: packages/ui/src/components/CurveEditor/functionMarks.tsx:62,89 (anchorMarks); packages/ui/src/components/CurveEditor/CurveEditor.module.css:62-65 (`.anchor.pinned`)
- scenario: `<CurveEditor endpoints="pinned-x" …>` (the `PinnedX` story). `pinned` is `isPinnedEndpointAt(...)`, which is true for `'pinned-x'` as well as `'pinned-both'`, so both endpoints get `s.pinned`. `.anchor.pinned` sets the gray `--curve-pinned-fill` and `cursor: default`, and it comes after `.anchor:hover` and `.anchor.active` at the same specificity, so it overrides both. The endpoint stays focusable and draggable in y (`canAnchorMove` is true, `withAnchorMoved` moves its y), and `hideNonInteractive`'s own doc says a `'pinned-x'` endpoint "still moves in y, so it stays". The user sees a mark styled like a locked one, no grab cursor, and no active fill while dragging it. The class should follow `canAnchorMove` (immovable = locked or `'pinned-both'` endpoint), not `isPinnedEndpointAt`.
- evidence: read
- severity: low

## Dragging an ordered anchor whose neighbors sit closer than two gaps puts it past its right neighbor
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:82-87 (withAnchorMoved)
- scenario: strict layer (`constrain="function"`, gap = x range / 1000 = 0.001 on [0, 1]), consumer value `[{x:0,y:0},{x:0.5,y:0.2},{x:0.5005,y:0.4},{x:0.5008,y:0.6},{x:1,y:1}]`. Drag anchor 2: `left = 0.5 + 0.001 = 0.501`, `right = 0.5008 - 0.001 = 0.4998`, and `Math.max(left, Math.min(right, nx))` returns 0.501 for any pointer x. The anchor ends at x = 0.501, right of anchor 3 (0.5008), so the list is no longer in x order: the curve that `'function'` promises to keep a function folds back on itself, and the monotone sampler is handed unsorted x. When `left > right` the anchor should stay where it is (or settle at the midpoint), never cross a neighbor.
- evidence: read
- severity: low

## Two layers editing on one key press record two undo steps, so one undo reverts only half of the key's edit
- where: packages/ui/src/components/CurveEditor/layerDispatch.ts:104-114 (dispatchKey); packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx:139-143 (onSvgKeyDown → settleEdit → record)
- scenario: two `CustomLayer`s whose `onKeyDown` both commit an edit for the same key without calling `preventDefault` (for example, both clear their selection on Delete with focus on the plot). `dispatchKey` hands each edit to `onEdit` separately, and `settleEdit` calls `record(before)` once per edit, so the stack gets two entries for one key press. Cmd+Z then reverts only the lower layer's edit, and a second Cmd+Z is needed for the other. `LayerStateProps`' doc says "a key … [is] one edit", and a pointer gesture that changes several layers is recorded once from `startStates`. The key's edits should be recorded as one entry from the snapshot taken before the first layer's turn.
- evidence: read
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

<!-- done: 3 findings, files read: 33 -->
