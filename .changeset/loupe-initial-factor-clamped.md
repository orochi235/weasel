---
'@weasel-js/loupe': patch
---

A loupe model starts at its `factor` clamped to `minFactor` and `maxFactor`, as `setFactor` clamps.

A stored factor outside the range no longer makes the first zoom in jump the other way.

<!-- entry: fix -->
