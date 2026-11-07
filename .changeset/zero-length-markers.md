---
'@weasel-js/stroke': patch
---

A zero-length subpath such as `M5 5 L5 5` places its start and end markers, facing along the x axis as SVG orients a head with no direction. Both were dropped. A lone moveto still places none.
