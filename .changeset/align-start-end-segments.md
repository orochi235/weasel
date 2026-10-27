---
'@weasel-js/core': patch
---

A text node's Align bar has Start and End segments of their own, drawn as `core:textAlignStart` and `core:textAlignEnd`. A paragraph aligned to `start` or `end` lights that segment, where it used to light the edge it resolved to under a stated direction and nothing under `auto`, and clicking Start or End writes the reading-order value instead of an edge.
