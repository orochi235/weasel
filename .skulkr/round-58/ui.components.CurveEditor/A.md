I couldn't finish writing `.skulkr/out/findings.md`: the first eight findings are in it, but permission was denied when I tried to add the last two and the file list. The brief says to put the whole document in the reply when the file can't be written, so here it is in full.

# Audit round 58 — ui.components.CurveEditor

Note: the brief names frozen commit b400d7039e8a…, which does not exist in this clone (`git cat-file` fails). The tree read is HEAD a22801b42b; every listed file under `packages/ui/src/components/CurveEditor/` is clean there.

## hideNonInteractive hides pinned-x endpoints, which can still be dragged in y
- where: packages/ui/src/components/CurveEditor/anchorRules.ts:10 (isHiddenAnchor)
- scenario: `<CurveEditor endpoints="pinned-x" hideNonInteractive …>`. `isHiddenAnchor` treats every pinned endpoint as one "that cannot move". So the first and last anchors are not drawn, and `functionHitAt` maps them to `FAR`, so no press reaches them. But `withAnchorMoved` lets a pinned-x endpoint move in y, and `anchorMarks` keeps it focusable (only `pinned-both` loses `tabIndex`). The user loses the only way to set the endpoints' y. The code also answers "can a pinned-x endpoint move" two ways: `isHiddenAnchor` says no, the focus rule at functionMarks.tsx:67 says yes.
- evidence: read
- severity: medium

## A curve press beside a locked anchor drags the locked anchor
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:95 (crowdedNeighbor), :130 (pressOnCurve)
- scenario: `constrain="function"`, a locked anchor, and a press on the curve within 2·ε (0.2 % of the x range) of it. This is reachable whenever the anchor's own hit test does not claim the press first, e.g. under `hideNonInteractive`, where locked anchors are hidden and hit-tested as `FAR`. `crowdedNeighbor` returns the locked neighbor and `pressOnCurve` makes it active. `onPointerDown` then returns `dragAnchor(neighbor)`, and `withAnchorMoved` has no locked check, so the drag moves a point that "can't be moved or deleted by the user". The anchor-hit path checks `locked` (createFunctionLayer.tsx:97); this path does not.
- evidence: read
- severity: medium

## Ordered anchors under an inverted x range jump to xMin and break their order
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:62-66 (withAnchorMoved)
- scenario: `xRange={[1, 0]}` with `domain="1d"` or `constrain="function"`. Plot2D maps an inverted range, and `clampToModelRange` handles it explicitly. Take points `[{x:0.2},{x:0.5},{x:0.8}]` and drag anchor 0:
  - `left = xMin = 1`
  - `right = points[1].x − ε`; ε is negative here, so this is 0.501
  - `nx = max(1, min(0.501, nx)) = 1`

  Anchor 0 lands at x = 1, past both neighbors, whatever the pointer does. The last anchor's `right = xMax = 0` pins it to 0 the same way. `pinned-x` has the same flaw: index 0 is set to `xMin`, out of order. `crowdedNeighbor`'s ε also goes negative, so its guard never fires.
- evidence: read
- severity: medium

## Arrow keys move a bezier handle the wrong way on a descending segment
- where: packages/ui/src/components/CurveEditor/keyframeEdits.ts:117 (nudgedBezier), createKeyframeLayer.tsx:159,175
- scenario: keys `[{t:0,value:10},{t:1,value:0}]`, segment 1 selected, focus on a handle, press ArrowUp. `move.dy` is +1, so the handle's y fraction rises by 0.01. The handle's model y is `lerp(a.value, b.value, yf)`, which falls as `yf` rises when `b.value < a.value`, so the handle moves down on screen.
- evidence: read
- severity: low

## Undo, redo and arrow keys run while a drag is in flight
- where: packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx:122 (onSvgKeyDown)
- scenario: hold a drag on an anchor and press Cmd+Z. The press and context-menu handlers both return early on `busy()`; the key handler does not.
  1. `undo()` restores every layer through `onInput`/`onChange` mid-gesture.
  2. The gesture keeps moving from the restored state.
  3. On release it records a new step from its `startStates`, which clears the redo stack and mixes the undone edit with the drag.
- evidence: read
- severity: low

## One-shot edits commit and record an undo step even when nothing changed
- where: packages/ui/src/components/CurveEditor/LayeredCurveEditor.tsx:90 (settleEdit); dispatchKey path :132
- scenario: in a keyframe layer, click the segment that is already selected (or press Enter on the already-selected key). `settleEdit` records a history step and calls `onChange` with an equal state, so the next Cmd+Z visibly does nothing. The gesture path skips unchanged edits with `deepEqual` (useLayerGesture.ts:67), and the handle nudge skips them by hand (createKeyframeLayer.tsx:177). The one-shot path doesn't check at all, so the same question gets two answers.
- evidence: read
- severity: low

## Two layers committing on one key leave a dead undo step
- where: packages/ui/src/components/CurveEditor/layerDispatch.ts:103-111 (dispatchKey)
- scenario: two layers both commit on one key, and neither calls `preventDefault`. `before()` reads `entry.state`, which has not re-rendered since the upper layer's `onInput`, so both steps record the same pre-key snapshot. The first Cmd+Z restores both layers; the second does nothing. For controlled layers the doc's "what before read just ahead of that layer's turn" is therefore stale.
- evidence: read
- severity: low

## Selected segment's bezier handles stay at the old key positions during a key drag
- where: packages/ui/src/components/CurveEditor/keyframeMarks.tsx:122,128 (keyframeMarks)
- scenario: with the segment into a key selected, drag that key. The curve, band and segment targets draw from `preview`. `activeBezier(state)` and `bezierHandles(state, …)` still read the committed keys and `state.selectedSegment`, so the handles stay where the key was. If the drag re-sorts the key past a neighbor, the handles draw on the wrong segment.
- evidence: read
- severity: low

## RimContour story: the partition layer swallows every press at the seam, so the seam's y cannot be dragged
- where: packages/ui/src/components/CurveEditor/LayeredCurveEditor.stories.tsx:103-106 (createPartitionLayer.hitTest)
- scenario: the partition layer is the topmost child and claims any press within 10 px of x = b, at any height. The seam anchors (pinned-x endpoints that move in y) both sit at x = b, so a press on either drags the seam sideways instead. The hit test should cover only the 28 px grip. It also starts a drag on any button, because it has no `isPrimaryPress` check.
- evidence: read
- severity: low

## A per-layer `--curve-line` recolors only the line, not that layer's anchors or default fill
- where: packages/ui/src/components/CurveEditor/CurveEditor.module.css:11-14 (.root)
- scenario: `--curve-fill`, `--curve-anchor-stroke` and `--curve-anchor-active-fill` are `var(--curve-line)` expressions declared on `.root`, so they are computed once at the plot root. A `--curve-line` set on a `[data-layer-id]` group therefore reaches only the line. LayeredCurveEditor.stories.module.css:14 does this for the spline layer: its curve turns purple, but its anchors and any color-less fill keep the default.
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

<!-- done: 10 findings, files read: 33 -->