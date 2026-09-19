---
'@weasel-js/core': patch
---

A `{ px }` stroke width no longer re-tessellates its ribbon on every frame of a
zoom. The width is now resolved against the zoom snapped to a fine grid, so
consecutive frames share a cached ribbon and a zoom no longer evicts the path's
other cached stroke styles. The drawn width stays within 1/8 of a screen pixel
of the width asked for. No API change.
