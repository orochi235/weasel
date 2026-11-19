---
'@weasel-js/core': patch
---

A `momentum` flick over a scene that the animator cancels mid-coast is recorded where it stopped, so undo takes the node back.

This covers `cancelAll` and the animator going away.

<!-- entry: fix -->
