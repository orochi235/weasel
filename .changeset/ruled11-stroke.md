---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/stroke': patch
'@weasel-js/paint': patch
'@weasel-js/path-tools': patch
---

A stroke whose width is 0 draws nothing, whatever its per-vertex widths and marker sizes, on every path.

- The renderer draws no marker head for a stroke with no width. Before, a head given its own `size` was drawn on a line that drew nothing, where SVG and PDF export drew neither.
- A node's stroke with no width is no longer hit by a click or hover within its per-vertex widths or its heads (`inkReach`), where nothing is drawn.
- `strokeEdgeNear` answers `null` for a stroke with no width, so the Girth tool no longer finds or drags edges of a stroke that draws nothing.
- `inkWidth`, the tessellator's test of whether a width puts down ink, is exported from `@weasel-js/stroke`.
- `resolveStroke`'s docs no longer say a stroke with no width can draw through its per-vertex widths.
