---
'@weasel-js/core': patch
---

A view animation between two very different zooms, such as from 1e9 to 1e-9, moves smoothly instead of producing a `NaN` view.

<!-- entry: fix -->
