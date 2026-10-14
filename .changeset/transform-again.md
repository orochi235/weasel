---
'@weasel-js/core': patch
---

Cmd/Ctrl+D is now Transform Again: it repeats the last move, nudge, rotate, resize, duplicate, or Alt-drag clone on whatever is selected, as one undo entry. A rotate repeats about the new selection's center and a resize repeats as the same scale held at the same handle's opposite corner. Duplicating and then moving the copies makes the copies' offset the step, so pressing Cmd+D again lays down another copy one step further each time. With nothing to repeat it duplicates, as Cmd+D did before.

Duplicate moves to Cmd/Ctrl+Shift+D. This changes a default binding: an app relying on Cmd+D to duplicate after a move now gets the move repeated.

The kit keeps the last transform per scene: `lastTransform(scene)`, `recordTransform(scene, transform, selectedIds)`, and `forgetTransform(scene)`, with the `RepeatableTransform` type. The action is `transformAgain` in the standard actions and the `edit` feature preset, in the `edit` group with a new `TransformAgainIcon`.
