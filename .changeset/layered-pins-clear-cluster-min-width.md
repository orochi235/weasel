---
'@weasel-js/diagram': patch
---

A layered layout keeps pins clear of a cluster's box as drawn, widened to its `minWidth`.

A nested cluster pads its parent's column only on the side it reaches, so a pin just clear of the drawn box is no longer refused.

<!-- entry: fix visual -->
