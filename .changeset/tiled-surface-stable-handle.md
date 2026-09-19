---
'@weasel-js/labkit': patch
---

`useTiledSurface` now returns the same handle across renders. A new handle each render reached `useSurfaceTile` through `SurfaceContext` as a new ref callback, which unregistered and re-registered every tile and made the next frame retile and repaint the whole surface.
