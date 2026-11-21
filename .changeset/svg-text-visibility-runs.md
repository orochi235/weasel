---
'@weasel-js/svg': patch
---

Importing SVG draws a `<tspan>` that sets `visibility="visible"` inside a hidden `<text>`, and a hidden `<tspan>` keeps its place on the line but paints nothing.

<!-- entry: fix visual -->
