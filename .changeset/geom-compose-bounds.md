---
'@weasel-js/geom': patch
---

`composePath` and `decomposePath` took a polygon parent's origin from the smallest control-point coordinate instead of its bounds, so a child of a curved parent composed off from where `boundsOfPath` puts that parent (12.5 units for `M0 0 C-50 0 -50 100 0 100`). Both now use `boundsOfPath`.
