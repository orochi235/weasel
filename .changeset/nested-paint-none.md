---
'@weasel-js/ui': patch
---

Fixes: `SelectionPanel` could not clear a fill or a stroke's paint. A `paint` leaf that is a field of an object leaf (`data.fill.paint`, `data.stroke.paint` in the default node properties) now offers "None", which removes the `paint` field from its parent and keeps the parent's other fields. An object the node holds with no `paint` reads as None, where it used to show the leaf's default as unset; a node holding no object at all still shows the default.
