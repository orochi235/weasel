---
'@weasel-js/diagram-formats': patch
---

DOT reads an HTML label laid out over several source lines as Graphviz draws it.

Its own line breaks add no blank lines, each table row is a line, and a row's cells are a space apart.

<!-- entry: fix data -->
