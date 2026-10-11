---
'@weasel-js/core': patch
---

`CursorCoordsHud` and `PickHud` take an optional `toWorld(clientX, clientY)` prop that replaces their own conversion through the canvas rect and view. `<Canvas>` passes one built from its `clientToWorld` prop, so on a CSS-transformed or otherwise custom-mapped canvas the world readout and the pick list now agree with what routing picks.
