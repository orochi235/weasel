---
'@weasel-js/editing': patch
---

`makeBooleanGroup` returns null when the scene refuses the batch, instead of the id of a group that was never made.

<!-- entry: fix -->
