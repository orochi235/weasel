# Findings: ui.components.CurveEditor (round 58)

## A click-empty insert ignores the layer's `xClamp`, so it drops an anchor outside the layer's sub-range
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:141 (withEmptyInsert)
- scenario: `FunctionLayer` with `addPointMode="click-empty"` and `xClamp={[0, 0.3]}` on an editor whose xRange is [0, 1]; click at x = 0.8. `withEmptyInsert` clamps only to `clampToModelRange(model, range)` (the plot's range) and inserts the point at x = 0.8, outside the range the layer is documented to stay in ("Override x clamp range for drags and pinned endpoints … constrain a layer to a sub-range"). The next drag of that anchor snaps it back into [0, 0.3] (`withAnchorMoved` clamps to xClamp), so an insert lands somewhere a drag can never put it. Should clamp x to `rules.xClamp` as `withAnchorMoved` does (one clamp for both paths).
- evidence: read
- severity: medium

## On an inverted x range the strict-function spacing epsilon goes negative, so anchors may cross and crowd detection never fires
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:63 (withAnchorMoved), :103 (crowdedNeighbor)
- scenario: `CurveEditor constrain="function" xRange={[1, 0]}` (no xClamp). `epsilon = (xMax - xMin) / 1000` = −0.001, so `left = prev.x − 0.001` and `right = next.x + 0.001`: a dragged anchor can be pushed past its neighbors by 0.001 or onto the same x, breaking the strict-function guarantee that `strict` exists for ("keep a sliver of x between them"). In `crowdedNeighbor`, `Math.abs(dx) < epsilon * 2` compares against a negative number and is never true, so a press on the curve right beside an anchor inserts a phantom point instead of dragging the neighbor. The same file already normalizes inverted bounds for the clamp a few lines below (`Math.min/Math.max`) and `withAnchorNudged` takes `Math.abs(xSpan)`; the epsilon should take the span's magnitude too.
- evidence: read
- severity: medium

## A press on the curve beside a locked (or hidden) anchor drags that anchor
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:130 (pressOnCurve), packages/ui/src/components/CurveEditor/createFunctionLayer.tsx:105 (onPointerDown)
- scenario: ordered curve (`constrain="function"`), anchor 2 is `locked: true`, steep segment next to it. Press on the curve within `2·epsilon` of anchor 2's x but outside the anchor hit radius (e.g. well above it on the steep segment). `crowdedNeighbor` returns index 2, `pressOnCurve` makes it active and `dragAnchor(2)` moves it — `withAnchorMoved` never checks `locked`. The anchor branch of `onPointerDown` refuses to drag a locked anchor (`if (state.points[index]?.locked) return;`), so the two press paths answer "may this anchor move?" differently. Same for an anchor `hideNonInteractive` has hidden ("Undrawn, it takes no press").
- evidence: read
- severity: low

## Undo, redo and arrow keys run while a drag is in flight, and the drag then records an undo step over them
- where: packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx:122 (onSvgKeyDown)
- scenario: drag an anchor and, with the button still down, press Cmd+Z. `onSvgPointerDown` and `onSvgContextMenu` both bail on `busy()`, but `onSvgKeyDown` does not: `undo()` restores the previous step through each layer's `onInput`/`onChange` while the gesture is live. The next pointermove calls `withAnchorMoved(current, index, …)` on the restored state, where `index` may now name a different anchor (or be out of range, if the undone step was an insert). On release, `onEdit(a.startStates)` records a new step whose "before" is the pre-drag, pre-undo snapshot, clearing the redo stack; undoing it then silently re-applies the edit the user just undid. Arrow keys mid-drag (`dispatchKey`) commit a separate step under the gesture the same way. Keys other than Escape should be ignored, or the gesture canceled first, while `busy()`.
- evidence: read
- severity: medium

## A curve layer's color override reaches the curve but not its anchors or default fill
- where: packages/ui/src/components/CurveEditor/CurveEditor.module.css:11-14 (.root)
- scenario: the stories stylesheet sets `[data-layer-id='spline'] { --curve-line: rebeccapurple }` (LayeredCurveEditor.stories.module.css:14) to color one layer. `--curve-fill`, `--curve-anchor-stroke` and `--curve-anchor-active-fill` are declared on `.root` as `var(--curve-line)`, so they are substituted once at the `<svg>` and inherit as the root color; only `.curve`'s `stroke: var(--curve-line)` resolves inside the layer's group. Result: a purple curve with default-colored anchor strokes, default-colored hover/active fill, and (for a layer with a fill but no `color` and no `--curve-fill` override) a default-colored fill. The file's own comment promises "consumers override … the curve-* var (component scope)". The derived vars should be resolved where they are used (e.g. `.anchor { stroke: var(--curve-anchor-stroke, var(--curve-line)) }`) rather than pre-bound on `.root`.
- evidence: read
- severity: low

## Arrow keys on a bezier handle of a descending segment move it the wrong way
- where: packages/ui/src/components/CurveEditor/keyframeEdits.ts:117 (nudgedBezier), packages/ui/src/components/CurveEditor/createKeyframeLayer.tsx:173 (onKeyDown)
- scenario: KeyframesDemo's segment into t=700 runs from value 90 down to 40. Select it, focus handle 1, press ArrowUp. `onKeyDown` turns Up into `dy = +1` ("model y runs up"), and `nudgedBezier` adds `+0.01` to the handle's y fraction. A handle sits at `lerp(a.value, b.value, yf)` (`handlePoints`), so on this segment a larger `yf` is a lower value: the handle moves down on ArrowUp and up on ArrowDown. The pointer path (`withHandleAt`) divides by `b.value − a.value` and so gets the sign right; the key path should scale `dy` by the segment's direction (and by its span, so one step is a steady distance).
- evidence: read
- severity: low

## Arrow keys move anchors and keys backwards on an inverted axis
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:163 (withAnchorNudged), packages/ui/src/components/CurveEditor/keyframeEdits.ts:106 (nudgedKey), packages/ui/src/components/CurveEditor/createKeyframeLayer.tsx:159
- scenario: `CurveEditor xRange={[1, 0]}` (or `yRange={[1, 0]}`), focus an anchor, press ArrowRight. The step is `move.dx * Math.abs(xSpan) * 0.01` added to model x, but `modelToPlot` maps a larger x further left when xMax < xMin, so the anchor moves left. Likewise ArrowUp adds model y, which an inverted yRange draws lower. The code treats inverted ranges as supported elsewhere (`clampToModelRange` "whichever way its axes run", the "Normalize bounds for inverted ranges" block) but takes the magnitude of the span here, throwing away the sign that would make the keys follow the screen. Same in the keyframe layer's `nudgedKey`.
- evidence: read
- severity: low

## Dragging a handle on a flat keyframe segment zeroes that handle's stored y
- where: packages/ui/src/components/CurveEditor/keyframeEdits.ts:136 (withHandleAt)
- scenario: keys `{t:0,value:50}`, `{t:100,value:50, easing:{bezier:[0.2,0.9,0.3,1]}}`; select the segment and drag handle 1 sideways. `yf = b.value === a.value ? 0 : …` writes 0 into `bezier[1]`, so the easing becomes `[x, 0, 0.3, 1]` though the user moved only x. It is invisible while the segment is flat, then shows as a changed ease once either key's value moves. On a flat segment y can't be read from the pointer, so the drag should keep `d.bezier[handle * 2 + 1]` rather than overwrite it.
- evidence: read
- severity: low

## Enter on an already-selected key or segment records an empty undo step
- where: packages/ui/src/components/CurveEditor/createKeyframeLayer.tsx:130 (keyOnKey), :165 (onKeyDown)
- scenario: focus the selected key and press Enter. `extra.commit({ ...state, selectedKey: index })` runs unconditionally, so `dispatchKey` hands `settleEdit` an edit: `record(before)` pushes a history step (clearing redo) and `onChange(next, prev)` fires with nothing changed. Cmd+Z then does nothing visible, and a user who had undone something loses their redo by pressing Enter. The arrow-key and drag paths already skip an unchanged commit (67cb291e6b, e073f0a5b3); Enter should too when `selectedKey`/`selectedSegment` already holds the target.
- evidence: read
- severity: low

## A key one layer commits without preventing default is undone together with the next layer's edit
- where: packages/ui/src/components/CurveEditor/layerDispatch.ts:96 (dispatchKey), packages/ui/src/components/CurveEditor/useLayerHistory.ts:37 (snapshot)
- scenario: two `CustomLayer`s whose `onKeyDown` both commit on the same key, the top one without `preventDefault` (the contract allows it: "`e.preventDefault()` keeps the key from the layers below"). `dispatchKey` reads `before()` ahead of each layer "so each edit is its own step", but `snapshot()` reads `entry.state`, which only updates on the next render, so the second step's `before` still holds the top layer's pre-edit state. Undoing the second step restores both layers; undoing the first then finds nothing to change and is a dead step. `before()` would need the edits already committed in this dispatch folded in (or the two recorded as one step, as the comment does not say).
- evidence: read
- severity: low

## A drag already in flight keeps editing and commits after the editor goes disabled or read-only
- where: packages/ui/src/components/CurveEditor/useLayerGesture.ts:48-71 (onMoveRef, onEndRef), packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx:170
- scenario: start dragging an anchor, then the consumer sets `disabled` (or `readOnly`) mid-drag, e.g. from a timer or because another control took the lock. `hold.gate` only wraps the next `onPointerDown`/`onKeyDown`/`onContextMenu`. The open pointer session keeps calling `publishLayer` on every move and `settleLayer(…{ commit })` on release, so a held editor still reports `onInput` and `onChange` and records an undo step. The component's own doc says that held, "no press, key, or context menu reaches a layer". Other ui edit hooks check the hold on every step (`useRangeEdit.ts:52,60`: `if (live.current.refuses) return;`); the curve editor should cancel the gesture when the hold starts refusing.
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

<!-- done: 11 findings, files read: 33 -->
