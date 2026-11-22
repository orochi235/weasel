---
'@weasel-js/diagram-formats': patch
---

Reading DOT no longer warns that a graph attribute was dropped when a cluster inside takes it up. That covers a color, style, stroke width, or label set on the graph or on a plain subgraph.

<!-- entry: fix -->
