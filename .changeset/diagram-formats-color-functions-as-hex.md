---
'@weasel-js/diagram-formats': patch
---

DOT and Mermaid write `hsl()`, `oklch()`, `oklab()` and `color()` colors as hex, so Graphviz and Mermaid draw them.

They already wrote `rgb()` that way.

<!-- entry: fix data -->
