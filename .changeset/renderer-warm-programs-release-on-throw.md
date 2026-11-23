---
'@weasel-js/renderer': patch
---

`warmPrograms` lets its WebGL context go when setting up its programs fails, so it no longer holds one of the page's few live contexts for good.

<!-- entry: fix -->
