---
'@weasel-js/core': patch
---

An edit whose edit passes answer only ops that change nothing still coalesces with the next edit, so a drag stays one undo step.

<!-- entry: fix -->
