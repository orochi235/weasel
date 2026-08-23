---
'@weasel-js/core': patch
---

Apply the inner view transform to a viewport node's source layers.

A world-space `RenderLayer` emits world coords and relies on its caller to wrap
them in `viewToMat3(view)`. `drawLayers` did that; `createViewportLayer` did
not — it concatenated `layer.draw(...)` output under a bare translate to the
rect origin. So a viewport's inner `view.x/y/scale` never reached the pixels,
while its `reproject` inverse assumed they had. Content drew at raw world
coords and hit-testing disagreed with what was on screen; at the identity inner
view the two happened to coincide, which is why it looked right in the demo.

Both paths now go through one exported helper, `drawOneLayer`, which puts a
layer's commands in the space its `space` field declares.

A screen-space source layer keeps drawing untransformed, but that means the
viewport's own CSS-pixel space — coords relative to the rect's top-left,
clipped to the rect. The previous doc comment claimed such layers rendered to
the outer canvas instead; they never did.
