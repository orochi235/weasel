---
'@weasel-js/renderer': patch
---

`imagePending(src)` says whether a load of `src`, or a re-raster of a vector source at another size, is in flight: whether `subscribeImageReady` will hear of a new bitmap for it.
