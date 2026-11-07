---
'@weasel-js/geom': patch
---

`pathToAnchors`, and every reshape built on it (`resamplePath`, `simplifyPath`, `openPathEnds`, and the rest), no longer throws "L without prior M" on a path that draws on after a `Z` with no `M`, such as one a `PathBuilder` makes with `lineTo` after `close()`. The segment after the `Z` starts a subpath at the closed one's start, as `forEachSegment` and SVG read it.
