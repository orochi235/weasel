---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

An image node's `data.image` takes `previous`: a `src` the `kit:image` painter draws in place of `src` while `src` decodes, so swapping a node's picture no longer flashes the loading placeholder. It is drawn only once it has decoded and never loaded on its own account, and the failure mark still shows once `src` fails.
