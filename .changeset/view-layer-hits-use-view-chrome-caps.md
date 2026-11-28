---
'@weasel-js/core': patch
---

A layer's `hitTest` in a `<CanvasView>` gets that view's chrome-caps predicate, the one it painted with, so it hits the chrome the view shows.

<!-- entry: fix -->
