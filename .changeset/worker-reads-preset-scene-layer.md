---
'@weasel-js/core': patch
---

`<SceneCanvas worker>` leaves the scene to the page when a preset fills the `scene` slot. It reads `cull` from the slot in force too.

<!-- entry: fix -->
