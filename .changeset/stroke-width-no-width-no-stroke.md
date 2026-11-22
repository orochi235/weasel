---
'@weasel-js/editing': patch
---

`setStrokeWidth` run with no usable width leaves a node without a stroke as it is, rather than giving it a default one.

<!-- entry: fix -->
