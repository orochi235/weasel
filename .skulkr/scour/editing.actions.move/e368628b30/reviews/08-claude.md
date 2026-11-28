## landedDescendantOps feeds a stored-frame delta to carriedDescendants, which translates world poses
- where: packages/editing/src/actions/move/landedDescendants.ts:34 (landedDescendantOps)
- scenario: `carriedDescendants`' `translate` receives each descendant's *world* pose and rebases the result (core `carryDescendants.ts:53`), but `dx, dy` here come from the bounds of the root's `from`/`to` as stored in its parent's frame. A layout reflow sibling inside a rotated (or scaled) layout container, or a dragged envelope group planted by `snapToContainer` / a layout `commitDrop` under a turned container, has envelope children stored in that container's frame: they get the local-frame delta applied along world axes, so on commit they land off their parent (rotated by the container's angle / scaled wrongly). The preview disagrees with the commit: `reflowCarry` in `layout/dropPass.ts:150` computes the same carry from world bounds, which is correct, so the children jump on release. With pure-translation frames the error cancels, which is why tests without turned containers pass.
- evidence: read
- severity: medium
- fix: packages/editing/src/actions/move/landedDescendants.ts
- size: function
- cause: local delta applied as world delta
- confidence: likely

## A throw while drawing the release frame leaves behaviors' dwell timers live, and they repaint a closed gesture
- where: packages/editing/src/actions/move/action.ts:79 (onEnd)
- scenario: on a `'commit'` end whose point differs from the last move, `show(endCtx)` runs every behavior's `onMove`. If one throws (a binding's behavior, a layout strategy hook), control goes straight to `finally`: neither `commitMove` (whose `reduceBehaviorEnd` calls every `onEnd`) nor `runBehaviorCancel` runs, so `snapToContainer`'s and `swapOnDrop`'s `after(dwellMs, …)` timers are never canceled. When one fires it calls `ctx.refresh` → `session.gestureCtx.refresh` (never cleared) → `show(lastMove)` → `hold.set(...)` on the already-dropped hold, and `shown.emit()`, so a ghost preview of the finished drag can reappear. Expected: the end path cancels behaviors whenever it does not reach their `onEnd`, and `refresh` is detached at close.
- evidence: read
- severity: low
- fix: packages/editing/src/actions/move/action.ts
- size: function
- cause: cancel not run on throwing commit path; refresh never detached
- confidence: likely

## Files read
packages/editing/src/actions/move/action.ts
packages/editing/src/actions/move/behaviors/clampMove.ts
packages/editing/src/actions/move/behaviors/index.ts
packages/editing/src/actions/move/behaviors/layoutDrop.ts
packages/editing/src/actions/move/behaviors/pageDrop.ts
packages/editing/src/actions/move/behaviors/reparentOnDrop.ts
packages/editing/src/actions/move/behaviors/snapBackOrDelete.ts
packages/editing/src/actions/move/behaviors/snapToContainer.ts
packages/editing/src/actions/move/behaviors/swapOnDrop.ts
packages/editing/src/actions/move/capture.ts
packages/editing/src/actions/move/commit/index.ts
packages/editing/src/actions/move/commit/layoutDrop.ts
packages/editing/src/actions/move/commit/layoutRelease.ts
packages/editing/src/actions/move/commit/pageDrop.ts
packages/editing/src/actions/move/commit/rebase.ts
packages/editing/src/actions/move/commit/reparent.ts
packages/editing/src/actions/move/delta.ts
packages/editing/src/actions/move/dragSnap.ts
packages/editing/src/actions/move/frame.ts
packages/editing/src/actions/move/gestureAdapter.ts
packages/editing/src/actions/move/index.ts
packages/editing/src/actions/move/landedDescendants.ts
packages/editing/src/actions/move/layout/container.ts
packages/editing/src/actions/move/layout/dragged.ts
packages/editing/src/actions/move/layout/dropPass.ts
packages/editing/src/actions/move/layout/exits.ts
packages/editing/src/actions/move/layout/glide.ts
packages/editing/src/actions/move/layout/types.ts
packages/editing/src/actions/move/layout/view.ts
packages/editing/src/actions/move/refusal.ts
packages/editing/src/actions/move/session.ts
packages/editing/src/actions/move/sessionOf.ts
packages/editing/src/actions/move/translate.ts

<!-- done: 2 findings, files read: 33 -->
