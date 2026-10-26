---
'@weasel-js/core': patch
---

`AimSource` takes an optional `subscribe(listener)`. A view marker whose source is an aim handed in by value now repaints when that source notifies; before, it repainted only when something else asked for a redraw.
