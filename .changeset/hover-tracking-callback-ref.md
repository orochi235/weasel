---
'@weasel-js/core': patch
---

`useHoverTracking` tracks an element that mounts after the hook does. This is a breaking change to the hook: it no longer takes `canvasRef`, and returns `{ getHover, canvasRef }` where it returned the getter alone. Hand the returned `canvasRef` the element (it is a callback ref) and read the hovered node from `getHover`.
