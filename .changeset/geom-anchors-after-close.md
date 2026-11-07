---
'@weasel-js/geom': patch
---

`pathToAnchors`, and every reshape built on it (`resamplePath`, `simplifyPath`, `openPathEnds`, and the rest), no longer throws "L without prior M" on a path that draws on after a `Z` with no `M`, as SVG's `M0 0 h10 v10 z l5 5` does. The segment after the `Z` starts a subpath at the closed one's start, as `forEachSegment` and SVG read it.
