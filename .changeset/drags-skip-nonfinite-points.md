---
"@weasel-js/core": patch
---

A drag ignores a pointer that is no finite number: a press there starts nothing, and a move there is skipped.

Move, resize, rotate, clone, insert, the marquee, and the lasso each go on from their last move.

<!-- entry: fix -->
