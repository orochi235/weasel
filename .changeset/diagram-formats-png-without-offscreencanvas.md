---
'@weasel-js/diagram-formats': patch
---

`exportPagePng` encodes its PNG on a page canvas where the browser has no `OffscreenCanvas`, instead of throwing.

<!-- entry: fix -->
