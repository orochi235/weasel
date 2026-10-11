---
'@weasel-js/core': patch
---

`computeFitView` and the minimap fit a rect with one zero axis along its other axis, so a scene whose only content is a horizontal or vertical line shows the whole line. It used to fall back to scale 1 at the rect's top-left; a rect with no positive axis still does.
