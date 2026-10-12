---
'@weasel-js/core': patch
'@weasel-js/geom': patch
---

Editing the points of a skinned path keeps its weights with its points. Inserting, deleting, cutting, nudging, and dragging anchors, and continuing or joining the path with the pen, now write the node's `data.skin` in the same undo entry as its path, so one undo restores both. Before, the weight arrays kept their old numbering and every point after the edit followed the wrong joints. A new point takes weights between those of the anchors either side of it, by its distance to each; a point drawn past an end takes the end's. Hand-painted weights are kept: nothing is weighed again from the bones.

Adds API: `editAnchorSetTracked(path, edit)` is `editAnchorSet` that also answers `origins`, where each point of the new path came from in the old one, and `remapPointValues(values, origins)` carries an array kept per point through that edit. `remapSkin(skin, origins)` does the same for a skin. `EditAnchorsDep.applyEdit` and `editOps` take `origins` as an optional fourth argument; a dep of your own that ignores it leaves a skin as it was.
