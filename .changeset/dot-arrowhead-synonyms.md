---
'@weasel-js/diagram-formats': patch
---

Reading DOT takes each arrowhead synonym, such as `empty`, `open`, and `ediamond`, as the arrowhead Graphviz draws for it.

An open chevron, which DOT has no arrowhead for, now writes as a plain arrow with a warning, where it had written as `empty`, a hollow triangle.

<!-- entry: fix data -->
