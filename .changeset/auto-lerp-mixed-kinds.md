---
'@weasel-js/core': patch
---

The default pose descriptor's `lerp` throws for a Path pose and a rect pose, rather than returning a pose with `NaN` bounds.

<!-- entry: fix -->
