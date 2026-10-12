---
'@weasel-js/core': patch
---

A layout drop and reparent-on-drop are now move behaviors. The move action builds both for each drag and runs them after the binding's own: the layout drop when the `layout` dep is present, then reparent-on-drop. Neither is exported; a layout is still configured on its container and reparenting by the binding's `reparentOnDrop` param. `docs/extending.md` ("Move behaviors") lists the whole chain.

What a consumer can observe:

- `MoveEnd` gains `pointer`: where the pointer was let go, in world coordinates, or `null`. Code that calls a `MoveBehavior`'s `onEnd` directly, such as a consumer's own test, must now pass it: `{ answered, translateOps, pointer }`. `ctx.pointer` still holds the last move's point.
- A layout strategy that throws mid-drag drops that frame, the way a throwing binding behavior does. The release then commits the last frame that held, as a plain move. It used to commit the throwing frame's position.
- With a reflow transition, a binding behavior's `onSettled` now runs before the layout drop settles its glides, where it ran after.

`committed`, as `onGestureEnd` and `onSettled` report it, now says whether the gesture's ops landed, for move, resize, rotate, and insert alike:

- `scene.applyBatch` returns a boolean: `false` when a container's layout refused what the batch dropped into it, which reverts the batch and records nothing.
- A layout drop the destination refuses reports `committed = false`. It reported `true`, and threw `SceneArrivalRefused` out of the gesture when the move was transient.
- A refused arrival in a transient resize, rotate, or insert no longer throws out of the gesture either. Nothing lands, and it reports `committed = false`.
- A consumer `applyOps` hook is still taken at its word: a commit handed to it reports `true`.
