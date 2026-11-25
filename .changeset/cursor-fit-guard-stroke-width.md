---
'@weasel-js/cursor': patch
---

`haloFitsInBox` and `rotationFitsInBox` measure a `stroke` path's outline by its own width as well as the halo's, so a stroke whose outline would be clipped no longer passes, and a `detail` by its own half width.

<!-- entry: fix -->
