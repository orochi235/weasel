---
'@weasel-js/renderer': minor
'@weasel-js/paint-kinds': patch
---

Disposing a paint-kind loader also removes the kind it loaded.

`registerPaintDrawKindLoader` takes an optional `{ register }`, which registers what the loader resolved to and returns the disposer that runs when the loader is disposed; it defaults to `registerPaintDrawKind`.

<!-- entry: fix api -->
