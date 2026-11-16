---
'@weasel-js/core': patch
---

The kit's clipboard keeps typed arrays and non-finite numbers by default

Its payload is written and read through the snapshot codec unless a consumer passes its own `jsonReplacer` or `reviver`, so a copy between two default canvases keeps a path's typed arrays and an `Infinity`.

<!-- entry: fix -->
