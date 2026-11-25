# Audit round 65 — ui.components.CurveEditor

## A press on the curve of an ordered layer can insert an anchor out of x order, and a click commits it that way
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:138 (pressOnCurve), with insertPoint at :48
- scenario: `CurveEditor` with `domain="1d"` or `constrain="function"`, 400×200 plot, anchors at x=0.5 (y=0) and x=0.52 (y=1), a steep segment between them. A press at plot (195, 185) is 15.8 px from the anchor (outside the 12 px snap) but about 5.5 px from the curve, so `functionHitAt` returns `{ kind: 'curve', segIdx: i }`. `pressOnCurve` inserts at `segIdx + 1` with x = 0.4875. It clamps x only to the plot and `xClamp`, never to `[points[i].x, points[i+1].x]`, and `crowdedNeighbor` doesn't fire (0.0125 > 2ε, and ε is 0 when `constrain` is `'none'`). If the press is released without a move, `dragAnchor.onCommit` only clears `activeIndex`, and `onChange` reports `[…, 0.5, 0.4875, 0.52, …]`: an ordered or function curve whose anchors are out of x order. Expected: the inserted x held between its neighbors (plus ε when strict), the way `withAnchorMoved` holds a drag.
- evidence: read
- severity: medium

## A click-empty insert ignores the 'function' constraint's x gap and can put two anchors at one x
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:150 (withEmptyInsert / emptyInsertIndex)
- scenario: `constrain="function"`, `addPointMode="click-empty"`, points `[{0,0},{0.5,0.5},{1,1}]`. A click at model (0.5, 0.9) is about 80 px from the middle anchor, so no anchor hit. `onEmptyPointerDown` inserts at x=0.5, and `findIndex(p.x > 0.5)` = 2 gives `[0, 0.5, 0.5, 1]`: a vertical segment on a layer that promises a sliver of x between anchors (`AnchorRules.strict`). The same happens at a clamped edge: with `xClamp=[0,0.5]` and a free last anchor at 0.5, any click right of 0.5 adds a second anchor at 0.5. `pressOnCurve` guards this case with `crowdedNeighbor` and `withAnchorMoved` enforces ε, so the empty-click path answers the same question differently. Expected: no insert, or an x moved off the neighbor by ε.
- evidence: read
- severity: medium

## The crowding threshold for a press on the curve uses the plot's x span, not the layer's xClamp span that drags use
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:110 (crowdedNeighbor) vs :76 (withAnchorMoved)
- scenario: a strict layer with `xClamp=[0, 0.1]` on an `xRange` of [0, 1]. `withAnchorMoved` uses ε = 0.1/1000 = 1e-4, but `crowdedNeighbor` uses ε = 1/1000 = 1e-3 and treats anything within 2e-3 as crowded. That is 2% of the layer's own range, so a press on the curve that far from an anchor drags the anchor instead of inserting a point. On a layer with `xClamp` wider than the plot the threshold is smaller than the drag gap instead, and an insert can land closer to a neighbor than a drag could ever bring it. Expected: one ε, from `layerXBounds`, for both.
- evidence: read
- severity: low

## A click-curve layer with minPoints unset can be deleted below two anchors, after which no press can add one
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:91 (withoutAnchor) and functionCurve.ts:56 (functionHitAt)
- scenario: a default `CurveEditor` (`addPointMode='click-curve'`, endpoints `'free'`, no `minPoints`) with two anchors. Shift-click or right-click one of them: `withoutAnchor` allows it because `minPoints` is undefined. With one anchor, `segmentSamples` returns `[]`, so no press ever hits `'curve'`, and `onEmptyPointerDown` refuses because the mode isn't `'click-empty'`. The user can no longer add any point; only the consumer can recover. Expected: click-curve mode keeps at least two anchors (an implied `minPoints` of 2), or the layer accepts an empty-space insert while it has no curve.
- evidence: read
- severity: low

## The keyframe layer's xClamp/yClamp take a reversed pair as a degenerate range; the function layer normalizes it
- where: packages/ui/src/components/CurveEditor/keyframeEdits.ts:90 (clampTo), used by createKeyframeLayer.tsx:83-88 and nudgedKey
- scenario: `KeyframeLayer xClamp={[1000, 0]}`, for example a range written to match an inverted `xRange`. `geom.clamp(v, 1000, 0)` returns 1000 for every v, so every key drag and arrow nudge pins the key to t=1000. `createFunctionLayer`'s `layerXBounds` takes `xClamp` low-to-high for exactly this case (the 8de44b2b06 inverted-range fix), so the two layers answer the same option two ways. Expected: `clampTo` orders the pair.
- evidence: read
- severity: low

## An arrow key on a bezier handle of a flat keyframe segment rewrites the handle's y, which a drag refuses to do
- where: packages/ui/src/components/CurveEditor/createKeyframeLayer.tsx:177-182 (onKeyDown, handle branch) with keyframeEdits.ts:120 (nudgedBezier)
- scenario: the selected segment runs between two keys with the same value, and a handle has focus. ArrowUp: `nudgedBezier` adds 0.01 to the handle's y fraction, `applyKeyframeDrag` returns new keys, and the layer commits. That reports an `onChange` and records an undo step, yet nothing moves on screen: the curve and the handle both draw at `lerp(a.value, b.value, yf)`, which is constant. When the segment later becomes non-flat, the hidden y suddenly reshapes its easing. `withHandleAt` deliberately keeps y on a flat segment (4f55a656f7), so the keyboard path answers that question the other way. Expected: on a flat segment a vertical arrow leaves y unchanged, and a pure-vertical nudge commits nothing.
- evidence: read
- severity: low

## An edit the consumer declines still records an undo step, so the next Cmd+Z silently does nothing
- where: packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx:91-95 (settleEdit) and useLayerGesture.ts:67-68, with useLayerHistory.ts:43-52 (restore)
- scenario: a `CurveEditor` whose consumer rejects an insert, so it never writes `value` back (a case `CurveEditor`'s own comment allows: "the consumer declined"). `settleEdit` compares the layer's `next` with `prev`, finds they differ, and calls `record(before)`. Undo then calls `restore(before)`, where every layer's `before` state `===` its current `entry.state`, so nothing is restored and nothing is reported. The step is used up and the user's Cmd+Z press has no effect; with several declined edits, several presses do nothing before a real step is undone. Expected: a step whose snapshot matches the current states on undo is skipped (or, equivalently, no op is recorded when nothing changed), so undo reaches the last real edit.
- evidence: read
- severity: low

## The rim-contour story's seam move crushes interior anchors onto the seam, breaking its own 'function' constraint
- where: packages/ui/src/components/CurveEditor/LayeredCurveEditor.stories.tsx:130-144 (clampPointsToRange), called from moveSeam :171
- scenario: in RimContour (bevel layer `constrain="function"`, an interior anchor at x=0.1), drag the partition grip to x=0.06. `clampPointsToRange(prev.points, [0, 0.06], true, true)` clamps the interior anchor to 0.06, the same x as the pinned last anchor: two anchors at one x on a function-constrained layer, a vertical segment in the drawn bevel. Dragging the grip back leaves them stacked, and the original shape is lost. The spline side does the same when the grip is dragged right past its interior anchors. A demo is a reference implementation, so it teaches consumers to produce states the layer forbids. Expected: interior anchors held at least ε inside the new range and in order (or the grip stopped at the nearest interior anchor).
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

<!-- done: 8 findings, files read: 33 -->
