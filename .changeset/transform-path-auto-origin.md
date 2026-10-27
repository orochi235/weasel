---
'@weasel-js/geom': patch
'@weasel-js/svg': patch
---

`transformPath` now gives a polygon that lands past `ORIGIN_THRESHOLD` (2^14) with no origin one of its own by default, so resizing a path, `pathInWorld`, and an SVG element's own skew or scale baked in on import keep their fractions far from 0. A rect it promotes to a polygon under rotation is measured from an origin too. Pass `{ autoOrigin: false }` for the old float32-only result. A caller that read a far-out result's `coords` without its `origin` now has to read through `worldCoords`.
