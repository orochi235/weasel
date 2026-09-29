---
'@weasel-js/core': patch
---

`useClipboardOps`'s `produceFlavors` may now return a promise for any flavor's text (the new `ClipboardFlavors` type). The OS write is still issued inside the copy, and the clipboard takes the text once it resolves, so an SVG flavor can `await warmSvg(nodes)` before it serializes without the copy losing its gesture. Additive: a producer returning plain strings behaves as before.
