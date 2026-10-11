---
'@weasel-js/geom': patch
---

`splitBySegment.ts` keeps the knife and snip entry points, and its segment math, contour reading, crossing detection, loop tracing, region assembly, and cut-polyline handling each move into a module beside it. Nothing it computes or exports changes.
