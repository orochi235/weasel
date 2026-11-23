---
"@weasel-js/diagram": patch
---

`setDiagramColor(…, 'stroke', …)` on a shape or connector drawn with no stroke gives it its role's width and dash, as applying the theme would, rather than a stroke with no width.

<!-- entry: fix visual -->
