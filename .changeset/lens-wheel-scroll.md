---
'@weasel-js/labkit': patch
---

A wheel over a lens now scrolls the scrolling element beneath it, as it would with no lens there. The lens hands the wheel on as a dispatched copy, which a browser never scrolls for, so the lens scrolls the nearest scroller that can move that way itself, unless something beneath called `preventDefault`.
