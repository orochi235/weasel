---
'@weasel-js/ui': patch
---

Fixes: a `DragGhost` drew in the font of the themed ancestor it portals to, so a row dragged out of a `Tree`, an `ItemList`, or a `LayerList` under an element that sets its own face changed face in flight. The ghost now takes the font family of the element it is dragged `from`.
