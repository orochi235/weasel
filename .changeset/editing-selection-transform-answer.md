---
"@weasel-js/editing": minor
---

`selectionTransformAnswer` says whether a move, turn or resize of the selection would change anything, and why not.

It returns `true`, `NotApplicable` when the finished batch changes nothing, or `Locked` when it would rewrite a locked node: the answer Transform Again gives, for a command's `enabled`.

<!-- entry: api -->
