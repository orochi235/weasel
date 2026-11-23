---
'@weasel-js/core': patch
---

`onPoseWrite` reports a node removed and put back within one change from the pose it stored before the change, so one that came back unchanged is left out even while it shows an override.

<!-- entry: fix -->
