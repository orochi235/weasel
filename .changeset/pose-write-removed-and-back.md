---
'@weasel-js/core': patch
---

`onPoseWrite` leaves out a node removed and put back unchanged within one change, even while it shows a pose override.

A node that did move is reported from the pose it stored before the change.

<!-- entry: fix -->
