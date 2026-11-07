---
'@weasel-js/diagram': patch
---

`fitDiagram` and its `DiagramFit` options are exported from `@weasel-js/diagram`: the view `DiagramView` opens on, for a host that holds the view itself through `view` and `onViewChange`. A ref on `EffectEditor` now reads `visible()`, the world rect it shows, and `rectOf(id)`, where a stage, group or wire is drawn in client coordinates, as a ref on `DiagramView` already does.
