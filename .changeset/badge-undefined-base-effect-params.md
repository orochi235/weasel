---
'@weasel-js/ui': patch
---

A badge's `baseParams` and effect `params` keep a default for a key set to `undefined`, as `shapeParams` already does, instead of drawing nothing.

<!-- entry: fix visual -->
