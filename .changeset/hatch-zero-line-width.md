---
"@weasel-js/renderer": patch
---

A hatch or crosshatch tile with a `lineWidth` of 0, a negative one or NaN draws no lines. The canvas a tile is rasterized on ignores such a width and strokes at the last one it was given, so the canvas drew 1-pixel lines where the SVG export drew none.
