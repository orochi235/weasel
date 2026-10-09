---
"@weasel-js/diagram": patch
---

`diagramScene` builds every box through `buildBody`, so a data node can set its `outline`, `rows` (label, field, ports and slot, with bold text), `padding`, `gap`, perimeter `ports`, `pinned`, a starting `at` and a minimum `width`/`height`. `lines` remains shorthand for label rows. Edges take `fromPort`/`toPort`, a per-edge `router`, `waypoints` and `labelPlacement`; `EdgeStyle` adds `dash`, `markerStart`, `markerEnd` and a `label` color, and `NodeStyle` adds `dash`. Options add `layout` by name (`'layered'`, `'tree'`, `'force'`), `measure`, `outline`, `padding`, `gap`, `minWidth` and `labelPlacement`, and `layoutOptions` now merge over the barycenter default instead of replacing it.

Box sizes change: padding is the body's uniform 8 rather than 12 by 8, and rows are spaced by `gap`.

`BodySpec.ports` replaces a body's four compass ports. A row's fallback height now follows its `fontSize` when no `measure` is given.

`DiagramView` adds `maxScale`, `fitPadding`, `background`, and a controlled `view` with `onViewChange`.
