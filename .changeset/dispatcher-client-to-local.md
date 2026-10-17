---
'@weasel-js/routing': patch
'@weasel-js/core': patch
---

`useGestureDispatcher` takes a `clientToLocal` option: the host's mapping from a client point to CSS pixels from the canvas's corner. The painted cursor, a wheel or pinch zoom's anchor, and a pending long-press's position use it; without it the element's rect is subtracted as before. `<SceneCanvas>` supplies its own, so on a canvas with a `clientToWorld` override — one drawn under a CSS transform, say — the painted cursor sits under the pointer and a zoom holds the point under it still.
