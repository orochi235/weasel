---
'@weasel-js/geom': patch
---

`cubicBounds`, `cubicAxisExtremaTs`, and `boundsOfPath` find the turn of a cubic whose cubic coefficient is only rounding, such as a quadratic elevated to a cubic far from 0. They solved the derivative with the textbook quadratic formula, which loses the root to cancellation there, and could miss the curve's furthest point by most of its width. Path snapping's extreme points used the same formula and now share the stable one.
