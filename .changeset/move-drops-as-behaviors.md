---
'@weasel-js/core': patch
---

A layout drop and reparent-on-drop are now move behaviors. The move action builds both for each drag and runs them after the binding's own: the layout drop when the `layout` dep is present, then reparent-on-drop. Neither is exported; a layout is still configured on its container and reparenting by the binding's `reparentOnDrop` param. `docs/extending.md` ("Move behaviors") lists the whole chain.

What a consumer can observe:

- `MoveEnd` gains `pointer`: where the pointer was let go, in world coordinates, or the last move's point when the release carries none. Code that calls a `MoveBehavior`'s `onEnd` directly, such as a consumer's own test, must now pass it: `{ answered, translateOps, pointer }`. `ctx.pointer` still holds the last move's point.
- A layout strategy that throws mid-drag drops that frame, the way a throwing binding behavior does. The release then commits the last frame that held, as a plain move. It used to commit the throwing frame's position.
- With a reflow transition, a binding behavior's `onSettled` now runs before the layout drop settles its glides, where it ran after.
- Every behavior's `onEnd` now runs even when an earlier one throws, for move, resize, rotate, insert, and lasso-select: the same guarantee `onSettled` and `onCancel` have. The ones after the throw are told `end.answered`, nothing commits, and the first error is rethrown once all have run. A behavior that releases something in `onEnd` used to be skipped.

`committed`, as `onGestureEnd` and `onSettled` report it, now says whether the ops landed, wherever a gesture commits ops: every commit of a move, resize, or rotate, and an insert whose behavior answered with ops. An insert no behavior claims still commits through the `insert` dep, and reports whether that minted a node.

- `scene.applyBatch` returns a boolean: `false` when a container's layout refused what the batch dropped into it, which reverts the batch and records nothing. That holds while a journal is taking the scene's batches. Inside `scene.batch` it returns `true`, since the enclosing batch owns the outcome and may still refuse.
- A layout drop the destination refuses reports `committed = false`. It reported `true`, and threw `SceneArrivalRefused` out of the gesture when the move was transient.
- A refused arrival on the transient route no longer throws `SceneArrivalRefused`: not out of a transient move, resize, or rotate, not out of an insert's behavior-answered commit, and not out of a move behavior's own later `ctx.adapter.applyOps`, such as `momentum` landing its coast. It lands nothing and returns.
- A consumer `applyOps` hook is still taken at its word: a commit handed to it reports `true`.

Fixed: a layout container inside the dragged subtree no longer takes the drop. A short drag of a group holding one could pick it, since it is tested where the document still holds it, and the commit then tried to reparent the group under its own descendant.
