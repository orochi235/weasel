---
'@weasel-js/routing': patch
---

`useHandleDrag` keeps a fixed handle's points steady when the page scrolls under a root element with `filter` or `backdrop-filter`, which holds no fixed box.

<!-- entry: fix -->
