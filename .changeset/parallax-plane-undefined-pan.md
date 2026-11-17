---
'@weasel-js/parallax': patch
---

A parallax plane's `set({ pan: undefined })` leaves the pan as it was, so the plane keeps drawing.

<!-- entry: fix -->
