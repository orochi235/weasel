---
'@weasel-js/diagram-formats': patch
---

DOT detection recognizes a header split only by a comment, such as `digraph/* x */G {`. A quoted graph id may also continue across a line.

<!-- entry: fix -->
