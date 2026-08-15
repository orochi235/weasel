---
'@weasel-js/core': patch
---

`viewport.pinchZoom` now pans as well as zooms. It anchored `zoomAt` on the
current gesture centroid and never translated by the centroid delta, so two
fingers travelling together — spread unchanged, zoom factor 1 — moved the view
not at all.

Each frame now anchors the zoom on the previous centroid and then translates by
how far the centroid travelled. Together those pin the world point under the
gesture midpoint as the midpoint moves, which is what makes a pinch feel
attached to the fingers.

The action's id and label are unchanged (`viewport.pinchZoom` / `Pinch Zoom`).
Consumers who bound it get panning with no wiring change.
