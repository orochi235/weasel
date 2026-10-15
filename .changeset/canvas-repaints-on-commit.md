---
"@weasel-js/core": patch
---

`<Canvas>`, and so `<SceneCanvas>`, repaints after every committed render
instead of only when a prop on a fixed list changed. A prop that reaches the
paint through a ref or a memo — `chromeVisibility` is one, since the
chrome-caps resolver reads its rules live — used to change on screen only when
something else happened to draw a frame. Renders that land before a frame
still paint once in it; a hover that changes nothing and a drag paint exactly
as many frames as before. `<CanvasView>` asks its surface for a frame on every
committed render for the same reason, so a change to its `bounds`, `layers`,
or layer gate alone now shows.
