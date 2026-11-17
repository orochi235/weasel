---
'@weasel-js/diagram': minor
---

`diagramColorOf` and `diagramFontSizeOf` read back the color and text size that `setDiagramColor` and `setDiagramFontSize` set.

`diagramColorOf(scene, id, 'text')` skips a header row, which takes the box's fill, and finds a connector's labels by what they depend on rather than by id.

<!-- entry: api -->
