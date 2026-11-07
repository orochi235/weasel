---
'@weasel-js/minimap': patch
'@weasel-js/labkit': patch
---

The linked crosshair keeps its screen size on both axes of a view whose scale differs between them. `crosshairRects` now takes its units per pixel per axis, `{ x, y }`, where it took one number; a caller drawing in screen pixels passes `{ x: 1, y: 1 }`. This breaks callers passing a number. The crosshair `createLinkedCursorLayer` paints used to size both axes from the view's x scale, so a stretched view drew its vertical arms too long or too short.
