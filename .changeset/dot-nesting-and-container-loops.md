---
'@weasel-js/diagram-formats': patch
---

The DOT reader refuses subgraphs nested more than 1000 deep with an error naming the line, rather than running out of stack.

<!-- entry: rank=-5 fix -->
