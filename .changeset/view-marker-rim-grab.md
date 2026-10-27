---
'@weasel-js/core': patch
---

A view marker that covers more than three quarters of the frame it is drawn in now grabs only a band about its rim, `VIEW_MARKER_HIT_SLOP_PX` either side, instead of its whole interior. A zoomed-out view's aim drawn across its whole frame used to take every press there; the frame now keeps them. A marker smaller than that, such as a minimap's, still drags from anywhere inside it.
