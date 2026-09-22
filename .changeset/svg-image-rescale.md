---
'@weasel-js/core': patch
---

An SVG image node (`data:image/svg+xml` source, or a URL ending in `.svg`) now stays sharp under zoom. The image cache re-rasterizes it at the size it is drawn, in power-of-two steps so a zoom gesture does not redraw it every frame, capped at the renderer's maximum texture size and 4096×4096 pixels. The previous raster keeps painting until the new one is ready, and its GL texture is freed when it is replaced. PNG, JPEG and other raster sources are unchanged.

New: `getImageBitmap(src, drawnAt?)` takes the size in device pixels an image is about to cover, `NodePaintCtx.pixelScale` carries device pixels per world unit to painters (`defaultDrawOne` fills it from the view and `devicePixelRatio`), and `isVectorImageSrc(src)` reports whether a source is treated as SVG.
