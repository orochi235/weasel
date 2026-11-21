---
'@weasel-js/ui': patch
---

A `SpanStrips` ruler whose steps are all too fine draws its ticks at a whole multiple of the last step, never closer than 64 px.

It keeps the tick at the window's end under a fractional step, and a step that is zero, negative, or not a number throws a `RangeError` instead of hanging the render.

<!-- entry: fix behavior -->
