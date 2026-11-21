---
'@weasel-js/ui': patch
---

A click in empty space on a `constrain: 'function'` curve never adds a point at an existing anchor's x.

The point lands just right of that anchor, or is not added where no room is left.

<!-- entry: fix -->
