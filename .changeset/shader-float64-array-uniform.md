---
'@weasel-js/renderer': patch
---

A shader command's array uniform takes a `Float64Array`, a kit matrix array included, and uploads it as float32 rather than rejecting it.

<!-- entry: fix -->
