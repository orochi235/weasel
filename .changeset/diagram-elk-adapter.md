---
'@weasel-js/diagram-elk': patch
---

New package, `@weasel-js/diagram-elk`: lays a diagram's `Graph` out once with ELK (elkjs) and answers with the diagram's own `LayoutPlan` — moves, routes, label places and the port each edge end meets — plus each group's box as ELK sized it and the pins it could not hold. Ports an edge names, edge labels and nested groups all go to ELK. elkjs's bundled build (about 1.6 MB, 467 KB gzipped) loads on the first layout, or a worker-backed ELK can be passed in.

`@weasel-js/diagram/layout` now also exports `anchorOffset`, `GraphGroup` and `LayoutPorts`, and the main entry `anchorOffset`.
