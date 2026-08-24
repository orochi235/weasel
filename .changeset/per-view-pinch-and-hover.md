---
'@weasel-js/core': patch
---

Route pinch and hover to the view under the pointer.

Both attached to the canvas and targeted the outer camera, so a pinch inside a
panel zoomed the canvas beneath it and hover resolved the wrong node. The view
registry now owns one `ViewResolver` for the surface, and the dispatcher, pinch
and hover all ask it — one authority, so they cannot disagree about where a
point landed.

`usePinchZoomTool` takes a `resolveTarget` option naming the camera an anchor
belongs to, and measures the anchor from that camera's origin. Omitted, it is
the canvas's own, as before.
