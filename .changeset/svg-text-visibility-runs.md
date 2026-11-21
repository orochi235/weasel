---
'@weasel-js/svg': patch
---

Importing SVG draws a `<tspan>` that turns `visibility` back on inside a hidden `<text>`. A hidden `<tspan>` keeps its place but paints nothing.

<!-- entry: fix visual -->
