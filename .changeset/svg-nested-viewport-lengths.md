---
'@weasel-js/svg': patch
---

A nested `<svg>`'s `x` and `y` were read as bare numbers, so `x="1in"` placed its content at 1 and `y="50%"` at 50 whatever the viewport. They are now read as lengths, units and percentages converted as on any shape. The root's `width` and `height` go through the same reader.
