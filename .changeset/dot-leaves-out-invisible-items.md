---
'@weasel-js/diagram-formats': patch
---

Reading DOT leaves out nodes and edges styled `invis`, and edges to an invisible node, with a warning naming them, rather than drawing them.

<!-- entry: fix data -->
