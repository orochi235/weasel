---
'@weasel-js/paint': minor
'@weasel-js/renderer': minor
'@weasel-js/core': minor
'@weasel-js/pdf': minor
---

A stroke with no paint that carries a marker draws its marker heads, as SVG does under `stroke="none"`, on the canvas and in PDF export.

A head painted in its own color is drawn; one painted the line's color (`'line'`) draws nothing. `resolveStroke` now keeps such a stroke rather than reading it as none, and its return type is the new `DrawnStroke`, whose `paint` may be absent. `hasMarker(stroke)` answers whether a stroke carries a marker at any of its places.

<!-- entry: fix visual api behavior -->
