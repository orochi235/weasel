---
'@weasel-js/labkit': patch
---

`useTiledSurface` produced no frame when a tile unregistered and every other tile kept its rect, so the registered clears never ran and whatever the departed tile had painted stayed on the shared buffer until something else moved. A tile leaving now makes the next frame `retiled`, as `SurfaceFrame.retiled` documents, including when it was the last tile.
