---
'@weasel-js/devtools': patch
---

`lazyDevtools` no longer raises an unhandled rejection when its hook fails to load after the canvas it was attaching to has unmounted.

<!-- entry: fix -->
