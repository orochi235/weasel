# Audit round 68 — editing.actions.insert

## A from-center line's `bounds` is twice the line's extent and centered on the mirrored start
- where: packages/editing/src/actions/insert/shape.ts:87 (insertShape)
- scenario: kind `line`, Alt held (mode `center`), drag from s=(0,0) to c=(10,0). `resolveEndpoints` mirrors the start to (-10,0), so the line runs (-10,0)→(10,0). `insertRectFor(-10,0,10,0,'center')` then treats the mirrored start as a center and returns x∈[-30,10] (width 40), not [-10,10] (width 20). That box goes to `dep.commit` and to `dep.peek` in `insertLanding`; a dep sizing or placing the line from `bounds` gets a box twice as wide and offset by the line's half-length. For a line in center mode, `bounds` should be the corner rect between the mirrored start and current (or `insertRectFor(..., 'corner')`).
- evidence: read (the math in shape.ts and geometry.ts). That the built-in line dep reads `bounds` is inferred; the preview reads `extras.a/b` and is unaffected
- severity: medium

## A behavior that returns a non-finite point mid-reposition leaves the carry applied while the frame is thrown away, so the next move carries the same step again
- where: packages/editing/src/actions/insert/action.ts:77-80 (onMove), packages/editing/src/actions/insert/frame.ts:56 (carryStart)
- scenario: while Space is held (`repositioning`), `carryStart` runs inside `finiteFrame`'s `next` thunk. It changes `session.place.site`/`parent`, the span snap's raw start, and `gestureCtx.origin` by (world − frame.pointer). If the frame that `nextFrame` returns fails `finiteFrame`'s `shows` check (a behavior's `onMove` returned a NaN `current`), `finiteFrame` returns `prev`, so `frame.pointer` stays at the old pointer while the carry has already happened. The next move carries again from that stale pointer, so the shape jumps by the dropped step a second time. `carryStart` should only run for a frame that is kept, or `pointer` should advance anyway.
- evidence: read (finiteFrame.ts:23-25 runs `next()` before it can reject the result)
- severity: low

## Files read
packages/editing/src/actions/insert/action.ts
packages/editing/src/actions/insert/commit.ts
packages/editing/src/actions/insert/extras.ts
packages/editing/src/actions/insert/frame.ts
packages/editing/src/actions/insert/geometry.ts
packages/editing/src/actions/insert/lands.ts
packages/editing/src/actions/insert/live.ts
packages/editing/src/actions/insert/params.ts
packages/editing/src/actions/insert/placeAction.ts
packages/editing/src/actions/insert/repositionAction.ts
packages/editing/src/actions/insert/rotateAction.ts
packages/editing/src/actions/insert/session.ts
packages/editing/src/actions/insert/shape.ts
packages/editing/src/actions/insert/style.ts

<!-- done: 2 findings, files read: 14 -->
