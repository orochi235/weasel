---
'@weasel-js/core': patch
---

`geometryGenerationOf` never answers a number it answered before, so a cache keyed on it rebuilds when a painter is removed.

<!-- entry: fix -->
