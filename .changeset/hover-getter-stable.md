---
'@weasel-js/core': patch
---

`useHoverTracking` returned a new getter on every render, though it documents a stable one, which rebuilt `SceneCanvas`'s chrome-rule callbacks each render. The getter is now stable, and it answers `null` once tracking is turned off instead of the last node hovered.
