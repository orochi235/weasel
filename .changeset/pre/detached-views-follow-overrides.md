---
'@weasel-js/core': patch
---

Detached views follow pose overrides

`<SceneViewCanvas>` and `<MinimapCanvas>` re-rendered off `scene.getVersion()`,
which a pose override deliberately never bumps — so they kept painting document
poses while `<SceneCanvas>` painted the overridden ones. A minimap beside a
canvas driving a drag or a simulation silently disagreed with it.

`<SceneViewCanvas>` now paints through `useFrameLoop` instead of from React, and
subscribes to `scene.overrides`. A render (prop change or version bump) and an
override commit both just mark the surface dirty, and one animation frame
coalesces them — so a 60 Hz override loop repaints these views with no React
render, and a backgrounded tab stops painting them entirely. The mount paint
stays synchronous, so the first frame is still the scene rather than a blank
canvas. `<MinimapCanvas>` inherits all of this through it.

Repaints driven by a prop change are now asynchronous: they land on the next
animation frame rather than in the layout effect of the render that caused them.
Code that renders and then reads pixels in the same tick needs to wait a frame.

A minimap's *framing* still derives from document poses, so a node overridden
outside the document bounds paints outside the fitted frame — recomputing the
fit per frame would rescale the whole minimap throughout a settle.
