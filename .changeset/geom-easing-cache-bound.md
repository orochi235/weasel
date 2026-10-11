---
'@weasel-js/geom': patch
---

`resolveEasing` kept every bezier easing it had ever resolved, so a curve editor dragging a handle grew the cache by an entry per pointer move for the life of the page. The cache now holds the 256 most recently added curves.
