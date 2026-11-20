---
'@weasel-js/diagram-formats': patch
---

`readDocument` recognizes a DOT file with an HTML graph id or an indented `#` comment line.

The DOT reader already read both.

<!-- entry: fix -->
