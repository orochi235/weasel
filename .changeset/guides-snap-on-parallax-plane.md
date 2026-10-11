---
'@weasel-js/guides': patch
---

Resizing or drag-inserting a node on a layer with `parallax` snapped to the wrong place: the resize and insert `snapToGuides` and `snapToGrid` behaviors compared the node's plane coordinates with the guide's or grid's camera coordinates directly, so an edge landed away from the drawn line by the plane's scale and offset. They now carry the guide or grid line into the plane first, as `guideSnapStrategy` and `gridSnapStrategy` already did for a move.
