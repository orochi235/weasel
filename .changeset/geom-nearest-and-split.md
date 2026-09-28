---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

geom gains nearest-point queries and de Casteljau splitting. `nearestOnLine`, `nearestOnQuadratic` and `nearestOnCubic` return the nearest point to a probe with its `t` and distance; `nearestOnPath` does the same over a whole command stream, closing edges included, and says which command's segment it landed on. `splitLineAt`, `splitQuadraticAt` and `splitCubicAt` split a segment at `t` into two that trace it exactly, and `quadraticEvalAt` joins `cubicEvalAt`. Core's `pathDistanceToPoint`, `splitCubicAtT` and the anchor editor's nearest-segment search now run on these, so curve distances in picking are exact rather than read off a 16-sample polyline.
