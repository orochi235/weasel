---
'@weasel-js/d3': patch
---

`join()` asks a binding's `.pose()` and `.payload()` once per datum, so an entering node whose pose is random snaps in rather than tweening between two poses.

<!-- entry: fix -->
