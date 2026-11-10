---
'@weasel-js/diagram-formats': patch
---

Graphviz DOT keeps a label whose last line is empty (it was written as a trailing `\n`, which reads as ending the line before it), quotes an id holding a no-break space or another non-ASCII space (the reader read it as a separator, so the file failed to read), and `detect` recognizes a graph whose quoted name holds `//` or `/*`.
