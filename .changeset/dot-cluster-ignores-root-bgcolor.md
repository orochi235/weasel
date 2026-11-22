---
'@weasel-js/diagram-formats': patch
---

Reading DOT no longer fills every cluster with the root graph's `bgcolor`, which the page does not draw. A cluster's own `bgcolor` still fills it.

<!-- entry: fix visual -->
