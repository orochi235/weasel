---
"@weasel-js/core": patch
---

The move, resize and rotate options that had been accepted and ignored since their hooks were deleted now work again, through the action pipeline:

- `moveLabel` / `resizeLabel` / `rotateLabel` name the history entry. Unset, a move takes the label of the ops a behavior or layout drop commits, where it used to say `Move` regardless.
- `transient` commits through `scene.untracked`, with no undo entry and without calling the consumer `applyOps` hook. Unset, a behavior's `defaultTransient: true` turns it on.
- `onGestureStart(ids)` fires when the gesture starts changing poses, and `onGestureEnd(committed)` exactly once after it. Resize and rotate now pass the id list rather than a single id.
- `UseMoveOptions.expandIds` replaces the moved id set, so a drag can carry linked nodes; `[]` declines the drag.
- `UseRotateOptions.behaviors` run as a rotate behavior chain, and `pivot: 'each'` turns each node about its own center.

`SELECTION_TRANSFORM_BINDINGS` and the `selectionTransformContribution` constant become the functions `selectionTransformBindings(options)` and `selectionTransformContribution(options)`, which take the rotate options; resize options travel in the `resizePolicy` dep, which `useResizePolicy` and `<SceneCanvas selectTool.resize>` now fill with the lifecycle fields too.

A resize behavior's `onEnd` returning ops now commits them in place of the resize, as the behavior contract says. A move whose behavior claimed or aborted the commit no longer leaves its preview poses published over the document.

Removed, since nothing read them: `UseInsertOptions` (the insert action takes binding params and the `insert` dep); `debug`, `handleHitRadius` and `rotationHandleDistance` on the resize and rotate options and `debug` on `UseSelectToolOptions` (`<SceneCanvas debug>` records handle hitboxes, and `selectTool.handleHitRadius` sizes them); `CloneBehavior.defaultTransient`.
