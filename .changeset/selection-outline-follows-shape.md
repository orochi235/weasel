---
'@weasel-js/core': patch
'@weasel-js/diagram': patch
'@weasel-js/geom': patch
---

The selection outline can follow a node's shape instead of its box. Set `outline: { follow: 'shape' }` on the `selectionOverlay` slot, or on `createSelectionOverlayLayer` / `createSelectionOutlineLayer` with `scene`, and each node's silhouette is stroked outward from its drawn edge (past its own stroke, when it has one) at the outline's width in screen pixels. A group, or a node with no outline to trace, keeps its box, and `pad` applies to boxes only. Additive; the default stays `'box'`. An `outline` given without a `paint` now keeps the default color rather than painting nothing.

`nodeOutline` takes an optional pose and silhouette context, for reading a node's outline somewhere other than its stored pose.

`DiagramView` outlines selected shapes along their outlines, and an item carried over a shape highlights the shape rather than its box; a container keeps its box in both.

`@weasel-js/geom` exports `flatSubpaths`, a path flattened into point runs split by whether each encloses area.
