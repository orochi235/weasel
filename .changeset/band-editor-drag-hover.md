---
'@weasel-js/ui': patch
---

`BandEditor` no longer flickers while a seam, an edge, or a band is dragged. The pointer runs ahead of what it drags, and a band it passed over took its hover fill and cursor for a frame at a time. Mid-drag, nothing inside the editor takes the pointer now, and the editor holds the drag's cursor (`ew-resize` for a seam or an edge, `grabbing` for a band) until the pointer is released.
