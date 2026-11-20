# Audit round 47 — editing.tools (blind reviewer)

Note: commit 44e73a944bea29d4d56fc7883fa302daec48ecf1 is not in this clone (`git cat-file` reports a bad object). The
checkout is at 782733b19c, and `git status` shows no changes under `packages/editing/src/tools`, so the files were read
from the working tree at that commit.

## A deferred click collapses the selection on release even though extend-clicks are locked
- where: packages/editing/src/tools/select/pressDecision.ts:39 (pressDecision), packages/editing/src/tools/select/collapseDeferred.ts:26-41 (createCollapseDeferredAction)
- scenario: `extendPressLocked` locks any Shift press "whatever the selection reads it as" (extendPressLocked.ts:9-15).
  Take a selection policy where Shift is neither toggle nor range (`{ mode: 'multiple', toggle: 'meta' }`), so
  `intentOf` gives `'replace'` for Shift and `extend` is false. While `extendClickLocked()` is true (anchor edit), the
  user Shift-presses a member of a multi-selection. `pressDecision` returns `applyNow: false` (locked) but still
  `deferred: top`, because `defer` ignores `locked`. On release, `select.collapseDeferred` is enabled (a deferral is
  set) and calls `selection.applyClick(deferred, { shift: true, … })` with no lock check. The selection collapses
  to the pressed node, which is the change the lock exists to stop. It should leave the selection alone: either
  `pressDecision` defers only when `!locked`, or the collapse re-checks the lock.
- evidence: read
- severity: low

## Alt-drag cloning ignores `move.dragThresholdPx` and the move run's lifecycle options
- where: packages/editing/src/tools/select/selectionContributions.ts:54-58, 68-69 (selectionMoveBindings, cloneOpts)
- scenario: a consumer passes `move: { dragThresholdPx: 12 }` so a slightly shaky press doesn't move anything.
  `moveOpts` carries the threshold into both move bindings, but `cloneOpts` builds the two clone bindings from only an
  `id` and the clone behaviors. An Alt-press on the same body that drifts 4 px opens a clone at the kit's default
  threshold and drops a duplicate. The same press without Alt does nothing. The threshold is a property of the press
  on the body, so both bindings should share it.
- evidence: read
- severity: low

## `pickTolerance` is documented as silhouette-only, but the default picker's derived-route hit depends on it under `'aabb'` too
- where: packages/editing/src/tools/select/adapterPointQuery.ts:29 (adapterPointQuery); doc at packages/editing/src/tools/select/usePickerSelectTool.ts:52-58 (UseSelectToolOptions.pickTolerance)
- scenario: under the default `leafPicking: 'aabb'`, `slop = preciseLeaves || derived ? t : 0`, so a node that
  derives its path (a connector route) is hit only within `pickTolerance` of its path's box. The code comment says
  this exists because "the box of a straight route has no area to land in without the slop". But the option's doc says
  it is "Only consulted under `leafPicking: 'silhouette'`", and the default is 0. An `'aabb'` consumer that reads the
  docs never sets it, so a straight horizontal or vertical route has a zero-height or zero-width box and can be hit
  only at exactly its coordinate, which in practice means never. Either the doc should say the tolerance also applies
  to derived nodes, or the derived case needs a nonzero slop of its own.
- evidence: read
- severity: low

## `useImageTool` accepts `share` and silently drops it
- where: packages/editing/src/tools/image/useImageTool.tsx:11, 35 (UseImageToolOptions, useImageTool)
- scenario: `UseImageToolOptions extends InsertToolOptions`, so `share` type-checks, and `InsertToolOptions.share`
  says it is "laid over the tool's own option shares". `useImageTool` reads only `behaviors` and never calls
  `shareToolOptions`; the tool declares no `options` at all. `useImageTool({ src, share: { … } })` compiles and does
  nothing, with no error or warning. Every other drag-to-insert tool in the area honors `share`. The interface should
  take only `behaviors`, or the tool should honor `share`.
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

<!-- done: 4 findings, files read: 34 -->
