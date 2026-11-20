---
'@weasel-js/diagram-formats': patch
---

DOT reads and writes color names as Graphviz draws them, in the X11 scheme.

`green` reads as `#00ff00` and `gray50` as a gray; a name under `/svg/` still reads as CSS's. Every color name is written as hex.

<!-- entry: fix data -->
