---
'@weasel-js/diagram': minor
---

`setDiagramColor` with `'fill'` leaves header text in the role's `headerText` where the theme names one.

That is how a shape built with that fill is drawn. `setDiagramColor` now takes a `theme` option, as `setDiagramStyle` does, defaulting to the scene's own.

<!-- entry: fix api -->
