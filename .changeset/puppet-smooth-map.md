---
'@weasel-js/geom': patch
---

`puppetMap` is smooth across its mesh: points between the solved vertices are placed by a Clough–Tocher interpolant instead of each triangle's affine map, so a puppet-warped outline bends without the small corners it used to pick up where it crossed from one triangle to the next. Pins still land exactly where they are dragged, pins that have not moved leave the shape exactly where it is, and a point off the shape is carried on in a straight line from the outline. Every puppet-warped shape redraws slightly differently.
