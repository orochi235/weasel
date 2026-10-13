---
'@weasel-js/geom': patch
'@weasel-js/svg': patch
'@weasel-js/renderer': patch
'@weasel-js/core': patch
---

Fixes: SVG import and export, the booleans, and the renderer's mesh cache disagreed with a path whose open subpaths no fill closes (`openFill: 'none'`, or `setDefaultOpenFill('none')`).

- `parseSvg` stamps `openFill: 'close'` on a `<polyline>` or `<path>` with an open subpath, since SVG always closes one to fill it. Such a path now carries a field it did not, and keeps painting under a `'none'` default.
- `serializeSvg` writes open subpaths no fill closes with `fill="none"`. A path mixing closed and open subpaths is written as a `<g>` of two `<path>`s, the group carrying the node's opacity, rotation, and metadata, so it reads back as a group of two.
- `pathUnion`, `pathIntersect`, `pathSubtract`, `pathExclude`, `pathDivide`, and the slice cuts leave such an open subpath out of the region. This changes their result for a path that says `'none'`.
- A mesh the renderer cached under one default rule is rebuilt after `setDefaultOpenFill` changes it, so the default no longer has to be set before the first paint.

Adds API: `splitByClosure(path)` and `hasOpenSubpath(path)` in `@weasel-js/geom`, re-exported from `@weasel-js/core`.
