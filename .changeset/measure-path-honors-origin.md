---
'@weasel-js/geom': patch
---

`measurePath` and `pointAlongPath` answer in the path's own space for a path measured from an `origin`.

So do `bendAlongPath`'s spine, `repeatAlongPath` and track paths, which read through it.

<!-- entry: fix -->
