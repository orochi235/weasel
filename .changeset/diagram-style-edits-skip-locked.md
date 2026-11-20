---
'@weasel-js/diagram': patch
---

The diagram style edits by hand leave a locked shape, connector or text row as it is, and edit the rest.

`setDiagramStyle`, `setDiagramColor` and `setDiagramFontSize` had thrown partway through.

<!-- entry: fix -->
