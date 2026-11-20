---
'@weasel-js/core': patch
---

A press inside a `<CanvasView>` reaches the view over a hit-testable `layers` entry, which paints under it.

Only a registered layer, which paints over every view, still claims such a press.

<!-- entry: fix -->
