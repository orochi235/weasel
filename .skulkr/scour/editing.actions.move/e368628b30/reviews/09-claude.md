## A dwell timer left running by a release that throws before the behaviors' `onEnd` repaints the drag's preview after the gesture closed
- where: packages/editing/src/actions/move/action.ts:55 (start → `session.gestureCtx.refresh`, `onEnd`)
- scenario: snapToContainer (or swapOnDrop) starts its `after(dwellMs, …)` timer in `onMove`; the timer is only cleared by that behavior's `onEnd`/`onCancel`. If `show(endCtx)` (the release-past-last-move frame) or anything in `commitMove` before `reduceBehaviorEnd` throws, the `finally` runs `closeRun` (hold dropped, `onSettled`) but neither `onEnd` nor `onCancel`, so the timer survives. When it fires it calls `ctx.refresh()`, which is still wired to `show(lastMove)` → `hold.set(preview.poses())` on the dropped hold, putting the drag's poses back into the scene's override table with nothing left to clear them; the node shows at the stale drag position until another gesture touches it. Expected: the close detaches `refresh` (or runs the behaviors' cancel when the commit path never reached them).
- evidence: read (runLifecycle.ts `closeRun` runs only `onSettled`; snapToContainer/swapOnDrop clear timers only in `onEnd`/`onCancel`)
- severity: low
- fix: packages/editing/src/actions/move/action.ts
- size: line
- cause: `refresh` never unhooked at close; cancel skipped on a throwing commit
- confidence: likely

## Innermost layout-drop target breaks same-depth ties by tree index, not paint order, so a container on a lower layer can beat the one drawn over it
- where: packages/editing/src/actions/move/layout/container.ts:62 (chooseContainer, `innermost` branch)
- scenario: two overlapping layout containers at the same depth on different layers, the one on the upper layer earlier in `scene.roots` (roots are not ordered by layer). Dropping where both contain the center picks the later-indexed one — the container painted underneath — while the user sees the drop land in the one on top. The `topmost` branch right above handles exactly this with `scene.renderOrder()` and says a sibling-index path cannot; the `innermost` tie-break claims "higher z = later index", which is false across layers (and across subtrees whose parents sit on different layers). Expected: equal-depth ties broken by render order, as `topmost` does.
- evidence: read (Scene.renderOrder doc: "layer by layer from the bottom"; `roots` carries no layer ordering)
- severity: low
- size: function
- cause: zPath sibling index used as paint order
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
