---
'@weasel-js/diagram': patch
---

`commitLaneResizeToScene` writes nothing where the resize would move a locked node, and stops a lane at its least size as the drag does.

A size that is not a finite number throws a `RangeError`.

<!-- entry: fix behavior -->
