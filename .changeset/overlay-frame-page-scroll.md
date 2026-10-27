---
'@weasel-js/ui': patch
---

A `Popover`, `Callout` or `Tooltip` portaled into a positioned, unscaled container now flips and limits its height against the viewport when the page itself is scrolled. React Aria read the overlay frame's boundary as offset from the frame by the page's scroll, so a popover with room below its trigger flipped above it, off the top of the viewport.
