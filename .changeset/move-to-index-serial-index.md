---
'@weasel-js/core': patch
---

`createMoveToIndexOp` holds its `index` as a finite integer that places the ids alike (`Infinity` as the top,
`NaN` as the bottom, a fraction truncated), so the op reads back from serialized history as it ran. JSON wrote
`Infinity` as `null`, and a move to the top undone and reloaded redid as a move to the bottom.
