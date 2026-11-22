---
'@weasel-js/diagram-formats': patch
---

Reading DOT holds a node's `width` and `height` to at least 0.01 inch, as Graphviz does. A zero or negative size no longer draws an empty or inverted box.

<!-- entry: fix visual -->
