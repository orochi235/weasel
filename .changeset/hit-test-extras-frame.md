---
'@weasel-js/core': patch
---

`hitTestExtras` takes an optional `frame` naming the camera to test under.

The method read the canvas's own `view` and `dims` off refs, which is right for
every existing caller and wrong for a point routed to a viewport node: there the
world point is in the node's inner view and a layer resolving a screen-pixel
tolerance needs that view and the node's rect size. `hitTestExtras(x, y, { view,
dims })` supplies both; omitting `frame` keeps the previous behavior, so no
existing call site changes.
