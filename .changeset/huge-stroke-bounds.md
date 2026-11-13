---
'@weasel-js/core': patch
---

`serializeSvg` boxes a stroked path with coordinates near float32's limit in about a millisecond, where it took up to half a second.

`strokedBounds` flattens such a path no finer than its float32 coordinates hold, and grows the box by that much so it still holds all the ink.

<!-- entry: perf -->
