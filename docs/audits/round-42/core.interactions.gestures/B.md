# Audit round 42: `core.interactions.gestures`, blind reviewer

Tree read: HEAD 782733b19c (the checkout in this worktree; the brief named a31056c5f3). Every finding comes from reading the code; none was run.

## useDragHandle's default ghost is sized in client px but drawn in its seat's scaled px
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:47 (defaultGhost)
- scenario: the source row sits under a portal host whose ancestor has `transform: scale(2)`. `fixedSeat` returns `scale: {x: 2, y: 2}`, and `positionGhost` now divides the position by it (commit 2940a774d2). `defaultGhost` still sets `width`/`height` from `getBoundingClientRect()`, which is already in client px, so the ghost draws at 2 × 2 = 4× the row's width instead of 2×. It should be `rect.width / seat.scale.x` (and the same for height). The centering in `positionGhost` uses `offsetWidth`, so the oversized ghost also stays centered and the bug looks like a sizing glitch, not a misplacement.
- evidence: read
- severity: medium

## When drop zones nest, the one registered first wins, not the innermost
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:35 (findZone)
- scenario: a folder row is a drop zone and its children are drop zones that mount when the folder expands. The children register after the parent, so `dropZones` (a Set, iterated in insertion order) returns the parent for a point over a child, since `parent.el.contains(el)` holds too. The drop and the `onOver` highlight go to the folder instead of the child under the pointer. Which one wins depends on mount order: React attaches child refs first on the initial mount, so the bug appears only for zones mounted or remounted later. It should pick the deepest accepting zone that contains `el`.
- evidence: read
- severity: medium

## useDragHandle starts a drag from a press on an SVG icon inside a button
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:185 (useDragHandle onPointerDown)
- scenario: a row handle holds `<button><svg>…</svg></button>`, such as a delete icon. A press on the icon has `e.target` set to an `SVGElement`, which is not an `HTMLElement`, so the `closest('input, button, select, textarea')` exclusion is skipped and dragging off the button starts a row drag. The same skip happens for a target from another realm (an iframe's elements). The check should test `e.target instanceof Element`, or just that `closest` exists.
- evidence: read
- severity: low

## A useDragGesture onActivate that cancels hands onMove a ctx whose fields throw
- where: packages/core/src/interactions/gestures/dragGesture/dragGesture.ts:136-139 (move)
- scenario: `onActivate` refuses the gesture by calling `controller.cancel()`. `cancel` sets `stateRef.current = null`, then `move` still calls `opts.onMove?.(buildCtx())`. `buildCtx` captures `s = stateRef.current!` (null), so the first `ctx.current` or `ctx.scratch` read in `onMove` throws `TypeError: Cannot read properties of null`. `onMove` also runs for a gesture that has already ended. The same happens in `useDragRect` and `useDragRadial`, whose `onMove` reads `ctx.scratch`. After the activation callback, `move` should check that `stateRef.current` is still `s`.
- evidence: read
- severity: low

## useDragRect and useDragRadial report isActive from render state, while useDragGesture reports it synchronously
- where: packages/core/src/interactions/gestures/dragRect/dragRect.ts:196, packages/core/src/interactions/gestures/dragRadial/dragRadial.ts:179 (returned controller)
- scenario: a handler calls `rect.start(...)` and then checks `rect.isActive` in the same tick, for example to decide whether a second pointer should cancel. It reads `false`, because `isActive` is `overlay !== null` from the memo of the last render. After `end()`, it stays `true` until the next render. The base controller answers the same question through a getter on `phaseRef`, so it is correct immediately. That is one question answered two ways, and the wrappers' answer is stale.
- evidence: read
- severity: low

## screenTolerance ignores the gesture's parallax plane
- where: packages/core/src/interactions/gestures/shared/screenTolerance.ts:10 (screenTolerance)
- scenario: a snap behavior on a node in a parallax layer compares pose distances, which are in plane-world units, against `screenTolerance(6, ctx)`. The helper converts 6 px through `ctx.view.scale` only, which gives camera-world units. `ctx.plane.scale` (outer.scale / inner.scale) is never applied, so on a plane at depth factor k the tolerance is off by a factor of k on each axis. `GestureContext.plane`'s own doc says a strategy must carry camera-world measurements through the plane before comparing them with a pose, and this helper, exported for exactly that comparison, does not.
- evidence: read
- severity: low

## useDragGesture never closes onGestureStart's pairing when its owner unmounts mid-gesture
- where: packages/core/src/interactions/gestures/dragGesture/dragGesture.ts:85 (useDragGesture; no unmount effect)
- scenario: a component using `useDragRect` with `onGestureStart` (opening a history batch, say) and `onGestureEnd` (closing it) unmounts mid-drag. `onGestureEnd` is documented as "Fired once per `onGestureStart`", but nothing fires it, and neither `onCancel` nor the wrappers' overlay reset runs. Whatever the start opened stays open. The teardown test (packages/core/src/teardown.test.tsx:66) checks only listeners and timers, so it does not catch this. An unmount effect should `cancel()` a live gesture.
- evidence: read
- severity: low

## The default drag ghost clones the source's id attributes into the document
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:43 (defaultGhost)
- scenario: a dragged row contains `id` attributes, such as a label's `for` target or an `aria-labelledby` target. `cloneNode(true)` keeps them, so for the whole drag the document holds two elements with each id. `getElementById` and the `aria-*` references then resolve to whichever comes first in tree order, and the ghost is appended to the portal host, so lookups can land on the ghost. The clone should strip `id` (and `aria-*` id references) from itself and its descendants.
- evidence: read
- severity: low

## Files read
packages/core/src/interactions/gestures/dragGesture/dragGesture.ts
packages/core/src/interactions/gestures/dragGesture/dragPointOf.ts
packages/core/src/interactions/gestures/dragGesture/index.ts
packages/core/src/interactions/gestures/dragRadial/dragRadial.ts
packages/core/src/interactions/gestures/dragRadial/index.ts
packages/core/src/interactions/gestures/dragRect/dragRect.ts
packages/core/src/interactions/gestures/dragRect/index.ts
packages/core/src/interactions/gestures/frames.ts
packages/core/src/interactions/gestures/pointerDrag/index.ts
packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts
packages/core/src/interactions/gestures/resizeHandles.ts
packages/core/src/interactions/gestures/shared/index.ts
packages/core/src/interactions/gestures/shared/originProjection.ts
packages/core/src/interactions/gestures/shared/screenTolerance.ts
packages/core/src/interactions/gestures/spec.ts
packages/core/src/interactions/gestures/types.ts

<!-- done: 8 findings, files read: 16 -->
