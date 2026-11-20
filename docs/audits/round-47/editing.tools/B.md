# Audit round 47 — editing.tools (blind reviewer)

Note: the checkout's HEAD is 782733b19c, not the 44e73a944b the brief names; paths and lines are cited from the tree as read.

## The deferred collapse applies the click with the release's modifiers and skips the extend-click lock
- where: packages/editing/src/tools/select/collapseDeferred.ts:93-101 (createCollapseDeferredAction run); packages/editing/src/tools/select/pressDecision.ts:228-230 (pressDecision)
- scenario: `extendClickLocked` returns true (SceneCanvas wires it to path anchor-edit mode), and A and B are selected. A plain press on A defers (`deferred: 'A'`) and nothing is applied. If the user then holds Shift (or Cmd) before releasing without dragging, `select.collapseDeferred` calls `selection.applyClick('A', {shift: true, …})` with the click's own modifiers. That toggle or range click changes the node selection even though the lock exists to block exactly that, which knocks the edited node out of the anchor edit. The intended result is a collapse to A, using the modifiers the press was classified with, or nothing at all under the lock. The run never calls `extendPressLocked`/`extendLocked`, so the same thing happens when `pressDecision` returns `deferred` for a press it also judged `locked` (it only drops `applyNow`, not `deferred`).
- evidence: read
- severity: low

## The Alt-drag clone bindings ignore `move.dragThresholdPx`
- where: packages/editing/src/tools/select/selectionContributions.ts:55-58, 68-69 (selectionMoveBindings cloneOpts)
- scenario: `createSelectionMoveContribution({ move: { dragThresholdPx: 24 } })`. A plain body drag waits for 24 px before it moves anything, as `MoveOptions.dragThresholdPx` documents. An Alt-drag on the same body goes to `clone`, whose binding opts are only `{ id, behaviors }`, so it opens at the kit's default `gestures.dragPx` and makes a copy after a few pixels of travel. The threshold is a gesture-level binding option, not a move param, so it should apply to the clone bindings too, the same way the comment above `moveOpts` says both move bindings "commit identically". Instead the option is silently dropped on the clone path.
- evidence: read
- severity: low

## Files read
packages/editing/src/tools/ellipse/index.ts
packages/editing/src/tools/ellipse/useEllipseTool.tsx
packages/editing/src/tools/eyedropper/index.ts
packages/editing/src/tools/eyedropper/useEyedropperTool.ts
packages/editing/src/tools/image/index.ts
packages/editing/src/tools/image/useImageTool.tsx
packages/editing/src/tools/lasso/index.ts
packages/editing/src/tools/lasso/useLassoTool.ts
packages/editing/src/tools/line/index.ts
packages/editing/src/tools/line/useLineTool.tsx
packages/editing/src/tools/polygon/index.ts
packages/editing/src/tools/polygon/usePolygonTool.tsx
packages/editing/src/tools/rect/index.ts
packages/editing/src/tools/rect/useRectTool.ts
packages/editing/src/tools/select/adapterPointQuery.ts
packages/editing/src/tools/select/collapseDeferred.ts
packages/editing/src/tools/select/extendPressLocked.ts
packages/editing/src/tools/select/groupEntry.ts
packages/editing/src/tools/select/index.ts
packages/editing/src/tools/select/pressDecision.ts
packages/editing/src/tools/select/selectDeep.ts
packages/editing/src/tools/select/selectPick.ts
packages/editing/src/tools/select/selectionContributions.ts
packages/editing/src/tools/select/testing/rectListAdapter.ts
packages/editing/src/tools/select/usePickerSelectTool.ts
packages/editing/src/tools/select/useSelectTool.ts
packages/editing/src/tools/shared/countOption.ts
packages/editing/src/tools/shared/insertToolOptions.ts
packages/editing/src/tools/shared/pointerFollower.ts
packages/editing/src/tools/shared/styleOptions.ts
packages/editing/src/tools/star/index.ts
packages/editing/src/tools/star/useStarTool.tsx
packages/editing/src/tools/toolOptions.ts
packages/editing/src/tools/toolSets.ts

<!-- done: 2 findings, files read: 34 -->
