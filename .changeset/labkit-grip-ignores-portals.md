---
'@weasel-js/labkit': patch
---

A press inside a portal rendered within a `<TileGrip>`, such as a title bar popover, no longer drags the tile.

React passes a portal's events up through the component that rendered it, so selecting text in a floating trial sidebar's field picked up the whole trial.

<!-- entry: fix -->
