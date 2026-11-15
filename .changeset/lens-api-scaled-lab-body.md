---
'@weasel-js/labkit': patch
---

A lab's lenses land under the pointer and stay on the lab body when it is shown scaled, as a nested lab in a zoomed stage is.

`createLensApi`, `lensClient`, the lens overlay's reticle, a hollow lens's redraw, and `sourceBoxIn` convert between client px and the element's own px at the scale it is shown.

<!-- entry: fix -->
