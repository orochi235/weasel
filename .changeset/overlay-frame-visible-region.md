---
'@weasel-js/ui': patch
---

A `Popover` or `Tooltip` opened inside a scrolling element no longer adds to its scroll range when a `transform`, `filter` or `contain` box inside the scroller holds it: there the overlay frame, though `position: fixed`, is contained like an absolute box. The frame is now cut to the part of the viewport no ancestor that clips it hides, so it lies inside every scrollport above it, and an overlay placed against it flips and shifts to stay inside the scroller that would otherwise cut it off. The same holds for a scaled box inside a scroller.
