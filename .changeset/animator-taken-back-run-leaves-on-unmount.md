---
'@weasel-js/animator': patch
---

A compositor run taken back to the main thread now leaves `live()` once its host has unmounted, as every other animation does.

<!-- entry: fix -->
