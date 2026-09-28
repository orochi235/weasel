---
"@weasel-js/core": patch
---

`<SceneCanvas>` draws the selection box for a node on a parallax scene layer where the plane draws the node. It used to land offset by the plane's lead or lag once the camera had panned. The chrome now reads the same bounds the picker does, so a `geometry.boundsOf` override also reaches the selection box, which it did not before.
