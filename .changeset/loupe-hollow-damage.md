---
'@weasel-js/labkit': patch
---

A hollow `<TrialLoupe>` under a tiled surface now invalidates only the tiles under the box it left and the box it moved to, so the host redraws those rather than the whole surface each time the lens moves. The surface gains `invalidateBox(box)`, which marks every tile a viewport-px box overlaps.
