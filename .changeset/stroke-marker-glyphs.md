---
'@weasel-js/core': patch
---

The stroke's Start, Mid and End marker selects draw a glyph beside each built-in marker and beside None, as the sibling cap, join, align and dash controls do: `core:markerArrow`, `core:markerCrowZeroMany` and the rest, in a new "Stroke markers" icon group, each a line with that marker on its end. A marker a consumer registers still reads as its id.
