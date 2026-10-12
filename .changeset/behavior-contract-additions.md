---
'@weasel-js/core': patch
---

A gesture behavior can do three more things. Two existing things change with them:

- Code that calls a `MoveBehavior`'s `onEnd` directly, such as a consumer's own test, must now pass a `MoveEnd` as the second argument: `{ answered, translateOps }`.
- For the dragged nodes `snapToContainer` has no slot for, the committed ops now come from the move's default translate. They carry the move's label where they carried the behavior's `moveLabel`, and include the geometry data op when `geometryProjection` is wired.

A move behavior that claims the commit can ask for the default translate of the nodes it did not place. Its `onEnd` is handed a `MoveEnd`, and `end.translateOps(ids)` returns the ops the action would have written for those dragged roots and the descendants that follow them, by the drag as the behaviors shaped it. `ActionBehavior` takes the type of that second argument as a fourth parameter, `BehaviorEnd` unless an action says otherwise. `snapToContainer` commits the nodes it has no slot for this way, which fixes undo for a derived node among them: undoing the drop left its authored pose at the derived one.

A behavior can act once the gesture's result is in the document. `onSettled(ctx, committed)` runs once per gesture, after the commit's ops have applied or the cancel has run, and after the preview overrides are dropped. `committed` is false when the gesture was canceled, aborted by a behavior, or released with nothing to commit, and true otherwise: the action or a behavior made the commit, a behavior claiming it with no ops included. For move, resize, and rotate it is the value `onGestureEnd` receives. Move, resize, rotate, insert, and lasso-select all call it, and still do when the commit throws. Every behavior's `onSettled` runs even when an earlier one throws, and the same now holds for `onCancel`; the first error is rethrown once all have run.

A move behavior can preview a node the drag does not move, and say which previews paint settled. `BehaviorResult.poses` was honored only for dragged ids; a pose for any other id now enters the gesture's previews too, in that node's stored frame, for the frame that returns it. Committing such a node is the behavior's job. `BehaviorResult.opaque` names ids whose preview paints at full opacity that frame, which the move action reports through `previewOpaqueIds` beside the siblings a layout drop reflows.
