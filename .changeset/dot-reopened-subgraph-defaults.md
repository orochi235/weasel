---
'@weasel-js/diagram-formats': patch
---

Reading DOT keeps a named subgraph's node and edge defaults when the file opens it again. A plain subgraph keeps the graph attributes it set, too.

<!-- entry: fix -->
