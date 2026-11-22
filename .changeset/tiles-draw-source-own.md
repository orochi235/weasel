---
'@weasel-js/tiles': patch
---

Each draw of a pyramid frame has a `source` array of its own, so changing one draw's source in place leaves the others alone.

<!-- entry: fix -->
