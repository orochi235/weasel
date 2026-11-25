---
'@weasel-js/cursor': patch
---

A baked cursor's hotspot is always a pixel inside its image, at most its width less one, so a one-pixel brush ring hotspots at `0 0`.

<!-- entry: fix -->
