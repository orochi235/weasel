---
'@weasel-js/core': patch
---

A text node that was hovered, marqueed, or used as a clip before its font finished loading kept the pick area measured against the fallback metrics, so clicks on part of the repainted text fell through to whatever was behind it until the node was next edited. `findShapeSilhouette` now measures a text node again when a face lands.
