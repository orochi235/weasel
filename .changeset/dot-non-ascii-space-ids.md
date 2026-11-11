---
'@weasel-js/diagram-formats': patch
---

Graphviz DOT quotes an id holding a no-break space or another non-ASCII space, so the file it writes reads back.

<!-- entry: fix -->
