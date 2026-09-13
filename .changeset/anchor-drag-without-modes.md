---
'@weasel-js/core': patch
---

Dragging a path anchor now edits the anchor on a canvas with no mode registry.
The drag used to move the whole shape: anchors sit on the selected body, so
`move`'s ambient binding matched the same press as `editAnchors` and won on
registration order. `move` now declines a press that hit an anchor or control
handle, and the drag falls through to `editAnchors`. Canvases that pass
`getActiveMode` were unaffected, because path-edit mode already filters `move`
out.
