---
'@weasel-js/core': patch
---

Edge panning on a `<SceneCanvas>` inside a CSS-transformed ancestor stops at its `limit` where it should, rather than letting the view scroll past it.

<!-- entry: fix -->
