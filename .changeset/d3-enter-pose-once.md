---
'@weasel-js/d3': patch
---

`join()` asks `.pose()` and `.payload()` once per datum, so an entering node with a random pose snaps in rather than tweening.

<!-- entry: fix -->
