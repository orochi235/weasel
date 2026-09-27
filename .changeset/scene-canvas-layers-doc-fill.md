---
"@weasel-js/core": patch
---

`<SceneCanvas>`'s `layers` doc now says the default scene slot paints each node's `data.fill`. It named `data.color`, which the default painter stopped reading when node paint moved onto `FillStyle`.
