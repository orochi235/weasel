# Audit round 42 — core.interactions.gestures (blind reviewer)

Note: the brief names a31056c5f3adeb20052a681c149c8af782f0f7b5 as the frozen commit, but this checkout has no such
object (`git diff a31056c…` → "bad object"). HEAD is 782733b19c; none of the area's files are modified in the
working tree. Line numbers below are at 782733b19c.

## A drop zone whose `accepts` throws strands the drag for every later drag in the page
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:131 (beginPointerDrag → drop), :120 (move), :36 (findZone)
- scenario: a `useDropZone({ accepts })` whose `accepts` throws for some kind (a consumer callback reading state
  that is gone). On release, `drop` calls `findZone` — which calls `accepts` outside `zoneCall` — *before*
  `teardown()`. The throw escapes, so `activeDrag` is never cleared and the ghost stays in the DOM; every later
  `beginPointerDrag` returns `null` at `if (activeDrag) return null`, so no `useDragHandle` in the document can
  drag again until reload. The throw also escapes `onEnd` at :211 before `setTimeout(dropClickGuard, 0)` at :215,
  so the capture-phase click swallower stays on the source row and eats its next real click. The `zoneCall`
  comment (:80) states the intent that a throwing zone callback "costs only itself, never the drag's teardown";
  `accepts` is the one zone callback not routed through it. Same throw from `move` leaves the drag running but
  propagates out of the session's move handler each frame.
- should: `teardown()` before resolving the zone (or guard `accepts` inside `findZone`), so a zone callback can
  never leave `activeDrag` set.
- evidence: read
- severity: medium

## Nested drop zones resolve by registration order, not by which zone is innermost
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:35 (findZone)
- scenario: a tree panel registers its root as a drop zone and each folder row as a drop zone, both accepting the
  same kind. `findZone` returns the first zone in the `dropZones` Set whose element contains the hit element.
  On first mount React attaches child refs before parent refs, so the folders register first and win; but a
  folder row mounted later (expanding a node, adding a row, a `key` change re-running the ref callback) is
  appended after the root, so hovering or dropping on that folder reports the *root* zone: the root gets
  `onOver(true)`/`onDrop`, the folder gets nothing. Which zone receives the drop depends on mount history.
- should: pick the deepest containing zone (e.g. walk up from `elementFromPoint`'s result and take the first
  element that is a registered, accepting zone).
- evidence: read
- severity: medium

## `useDragHandle` calls the press-time `getPayload`, not the current one, at threshold
- where: packages/core/src/interactions/gestures/pointerDrag/pointerDrag.ts:201 (useDragHandle onPointerDown/onMove), :226
- scenario: the doc says `getPayload` "is read at threshold-cross time", and `options` and kit settings are read
  through `useLatest`, but `getPayload` is captured by the `onPointerDown` closure. A list row whose own
  pointerdown selects it (setState) and whose `getPayload` is an inline closure reading `selectedIds` crosses
  the threshold after that re-render, yet calls the closure from the render *before* the press, so the payload
  carries the previous selection's ids (dragging an unselected row drags the old selection). One hook answers
  "latest" for two of its inputs and "press-time" for the third.
- should: read `getPayload` through `useLatest` like `options`.
- evidence: read
- severity: low

## `useDragRect`/`useDragRadial` `isActive` disagrees with the base controller's
- where: packages/core/src/interactions/gestures/dragRect/dragRect.ts:196, packages/core/src/interactions/gestures/dragRadial/dragRadial.ts:179
- scenario: `useDragGesture`'s controller exposes `isActive` as a getter over `phaseRef`, true the moment
  `start()` returns and false the moment `end()`/`cancel()` returns. The wrappers instead expose
  `isActive: overlay !== null`, a value frozen into the memoized object from React state. Code holding the
  controller that calls `rect.start(...)` and then checks `rect.isActive` in the same handler (or a native
  listener / ref-held controller read before React re-renders) sees `false`; after `rect.end()` it still sees
  `true` until the next render, so a guard like `if (rect.isActive) rect.end()` in a second listener for the same
  release runs `end` on an already-idle gesture (a no-op, but any consumer state keyed on it is wrong). The same
  question — is a drag in flight — gets a synchronous answer from one controller and a one-render-late answer
  from the two built on it.
- should: forward the base controller's getter (`get isActive() { return gesture.isActive; }`).
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

<!-- done: 4 findings, files read: 16 -->
