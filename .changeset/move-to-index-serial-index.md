---
'@weasel-js/core': patch
---

A `createMoveToIndexOp` move read back from saved history redoes as it ran, a move to the top included.

The op holds its `index` as a finite integer that places the ids alike: `Infinity` as the top, `NaN` as the bottom, a fraction truncated.

<!-- entry: fix data -->
