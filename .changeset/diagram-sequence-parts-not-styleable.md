---
'@weasel-js/diagram': patch
---

`setDiagramStyle` and `setDiagramColor` leave a sequence and its parts alone.

`diagramStyleOf` answers `null` for them: a sequence draws its parts from its data, so an edit there was lost at the next redraw.

<!-- entry: fix -->
