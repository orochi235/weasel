---
'@weasel-js/renderer': minor
'@weasel-js/paint-kinds': patch
---

Declaring your own loader for the lazy `mesh-gradient` built-in no longer draws the development clash warning.

`registerPaintDrawKindLoader` takes `fallback`, as `registerPaintDrawKind` does, and `registerPaintKindLoader` passes its own through to the loader.

<!-- entry: fix api -->
