---
'@weasel-js/routing': patch
---

`toolOptionsPrefs` throws when two tools share an option that is not a number, an enum or a string and declare it differently, as a list with different `maxItems`, rather than cutting one tool's values to the other's bounds.

<!-- entry: fix -->
