# Audit round 65 — ui.components.CurveEditor

## A press on the curve of an ordered layer inserts an anchor outside its segment's x span, breaking x order
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:138 (pressOnCurve; insertPoint at :48)
- scenario: `domain: '1d'` (or `constrain: 'function'`), points `[{0,0},{0.5,0},{0.501,1},{1,1}]` on a 400px plot. The
  segment 1→2 is near-vertical; a press 6px left of its middle is within `CURVE_HIT_PX` (8) of the curve and >12px
  from both anchors, so `hitTestCurve` returns segIdx 1. `pressOnCurve` inserts at index 2 with the press's own x
  (≈0.485), which is left of anchor 1 (0.5). `insertPoint` clamps only to the plot and `xClamp`, never between the
  segment's anchors, and `crowdedNeighbor` only fires within 2·range/1000 (0.8px here; never with non-strict `'1d'`,
  whose epsilon is 0). Released without moving, `onEnd` sees the new point, commits, and the consumer gets
  out-of-order points on a layer that promises "an anchor cannot be dragged past its neighbors". The same happens
  wherever catmull-rom's samples overshoot their anchors in x. Should clamp the inserted x into
  `[points[segIdx].x + ε, points[segIdx+1].x − ε]` when `rules.ordered`, as `withAnchorMoved` does for a drag.
- evidence: read
- severity: medium

## Unmounting the editor mid-drag never reports `onCancel` (nor restores `onInput`) to the dragged layer
- where: packages/ui/src/components/CurveEditor/useLayerGesture.ts:116 (unmount effect) with :75 (onCancelRef / currentState) and CustomLayer.tsx:43 (unregister)
- scenario: a `LayeredCurveEditor` (or `CurveEditor`) is unmounted while an anchor drag is in flight, e.g. a panel
  closing on a shortcut. React runs the deleted subtree's layout-effect cleanups (each `CustomLayer`'s
  `register(own)` disposer) in the mutation phase, before passive-effect cleanups; so when the editor's
  `useEffect(() => () => sessionRef.current?.cancel())` runs, the registry is already empty, `currentState(a.entry)`
  is `undefined`, and `onCancelRef` takes the `finish()` early return: no restore to `onInput`, no `onCancel`. The
  same happens when only the active layer child unmounts mid-drag (its entry leaves the registry, and the next move
  or the release just finishes). `docs/conventions.md` "Edit callbacks" lists "an unmount mid-drag" as a
  cancellation that must send the start value to `onInput` and then `onCancel`; a consumer that opened a
  transaction on `onInput` is left with it open. The existing test (CurveEditor.test.tsx:805) only asserts that
  moves stop reaching the document.
- evidence: read
- severity: medium

## A layer whose consumer previews but does not write `onInput` back never commits a drag
- where: packages/ui/src/components/CurveEditor/useLayerGesture.ts:62 (onEndRef) via layerHost.ts:20 (stateOf)
- scenario: `<FunctionLayer state={s} onInput={log} onChange={setS} />` — the "caller that only follows live values
  passes `onInput` and … the same handler as `onChange`" shape `docs/conventions.md` describes. With `onInput`
  present there is no draft, so each move's `onMove` reads `entry.state` (the consumer's, unchanged) and the
  published preview is never fed back; at release `onCommit(current)` returns the consumer's original points with
  `activeIndex: null`, which `deepEqual`s `startSelfState`, and the edit settles `'unchanged'`: `onChange` never
  fires although `onInput` reported a moved point. `KeyframeLayer` loses the drag the same way (`applyKeyframeDrag`
  sees no `drag` on the consumer's state). The commit should come from the last state the runner published, not only
  from the consumer's echo. (`CurveEditor` hides this behind its own `held` state; the bare layers do not.)
- evidence: read
- severity: medium

## A click-empty insert on a `constrain: 'function'` layer can land on an existing anchor's x
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:150 (withEmptyInsert / emptyInsertIndex)
- scenario: `constrain: 'function'`, `addPointMode: 'click-empty'`, `endpoints: 'free'`, points `[{0,0},{1,1}]`,
  xRange `[0,1]`. A click right of the last anchor clamps to x=1; `findIndex(p.x > 1)` is -1, so the point is
  appended at x=1 beside the existing x=1 anchor: two anchors with one x, a vertical step in a curve the layer
  constrains to be a function. Likewise a click at exactly an anchor's x. Neither the strict epsilon nor the
  `crowdedNeighbor` redirect that `pressOnCurve` applies runs on this path, so the two insert paths answer "may a
  new anchor sit on a neighbor's x" differently.
- evidence: read
- severity: low

## The crowding threshold and the drag's spacing read different x spans when `xClamp` is set
- where: packages/ui/src/components/CurveEditor/functionAnchorEdits.ts:110 (crowdedNeighbor) vs :76 (withAnchorMoved)
- scenario: `constrain: 'function'`, `xClamp: [0, 0.1]`, xRange `[0, 1]`. `withAnchorMoved` keeps anchors
  `(0.1−0)/1000 = 1e-4` apart, from the layer's x bounds, while `crowdedNeighbor` treats a press within
  `2·|1−0|/1000 = 2e-3` (from the plot's range) of a neighbor as a press on that neighbor — 20× the spacing the drag
  enforces, 2% of the layer's own span. A press on the curve that a drag could legitimately place grabs the
  neighbor instead. Both should take `layerXBounds`.
- evidence: read
- severity: low

## Undo/redo compares layer states by identity, so an unchanged layer is reported an edit
- where: packages/ui/src/components/CurveEditor/useLayerHistory.ts:43 (restore)
- scenario: two layers; layer B's consumer builds its state inline each render (`state={functionLayerState(pts)}`)
  or re-derives it with equal values. Undo of an edit on layer A runs `restore`, which tests `prev !== current` by
  reference: B's snapshot object and its current object differ while deep-equal, so B gets `onInput(prev)` and
  `onChange(prev, current)` for an edit that changed nothing. The conventions say `onChange` fires "never for one
  that changed nothing", and the editor's other settle paths (`settleEdit`, `onEndRef`) decide this with
  `deepEqual`; history decides it by identity.
- evidence: read
- severity: low

## Canceling a keyframe key drag leaves the press's selection change in the consumer's state, uncommitted
- where: packages/ui/src/components/CurveEditor/createKeyframeLayer.tsx:52 (settleDrag.onCancel) with :113 (onPointerDown)
- scenario: keys with `selectedKey: null`; press key 1 (the press publishes `selectedKey: 1` to `onInput`), drag,
  press Escape. `onCancel` returns `{ ...current, drag: null }`, so the restore sent to `onInput` keeps
  `selectedKey: 1`, then `onCancel` fires. The conventions require the cancel to send "the value the edit began
  from"; the consumer is left with a selection no `onChange` reported and no undo step holds, while the same
  release without moving commits it as an edit. Should restore the gesture's start state (the default when
  `onCancel` is absent).
- evidence: read
- severity: low

## The rim-contour story's seam drag destroys the other layers' anchors on Escape
- where: packages/ui/src/components/CurveEditor/LayeredCurveEditor.stories.tsx:171 (moveSeam) / :212 (onPartitionChange)
- scenario: drag the partition grip left past the bevel's interior anchors; `moveSeam` clamps them into `[0, next]`,
  piling them at the seam (several anchors at one x on a `constrain="function"` layer). Press Escape: the runner
  restores only the partition (`onInput(startSelfState)` → `moveSeam(original b)`), and re-clamping cannot unpile
  the anchors, so the bevel and spline stay mangled with no undo step recorded (a cancel records none). A
  reference demo of cross-layer reactivity whose cancel breaks; it should derive the clamped points from the
  drag-start states rather than clamp the live ones on every move.
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
