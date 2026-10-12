---
'@weasel-js/core': patch
---

A gesture behavior can do three more things. This is new API; nothing existing changes.

A move behavior that claims the commit can ask for the default translate of the nodes it did not place. Its `onEnd` is handed a `MoveEnd`, and `end.translateOps(ids)` returns the ops the action would have written for those dragged roots and the descendants that follow them, by the drag as the behaviors shaped it. `ActionBehavior` takes the type of that second argument as a fourth parameter, `BehaviorEnd` unless an action says otherwise. `snapToContainer` commits the nodes it has no slot for this way, which fixes undo for a derived node among them: undoing the drop left its authored pose at the derived one.

A behavior can act once the gesture's result is in the document. `onSettled(ctx, committed)` runs once per gesture, after the commit's ops have applied or the cancel has run, and after the preview overrides are dropped. `committed` is the value `onGestureEnd` gets: true only when the gesture wrote to the document, so an abort, a release with nothing to write, and a cancel report false. Move, resize, rotate, insert, and lasso-select all call it, and still do when the commit throws.
