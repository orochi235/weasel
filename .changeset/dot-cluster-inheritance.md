---
'@weasel-js/diagram-formats': patch
---

Writing DOT, an unlabeled container nested in a labeled one now sets an empty label, and a lane (or any region without a fill) inside a filled one sets an empty style. Graphviz carries a cluster's attributes into the clusters inside it, so such a container used to draw, and read back with, its parent's label, and a lane its pool's fill.
