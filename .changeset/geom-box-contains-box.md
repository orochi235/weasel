---
"@weasel-js/geom": patch
"@weasel-js/labkit": patch
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

geom adds `boxContainsBox(outer, inner)`, the edge-inclusive test for one box
wholly holding another. Core's region hit test, labkit's `fracEncloses`,
`fracContains` and drop-over-canvas check, and labkit's internal point bounds now
go through geom's box functions instead of their own copies. labkit's `WorldRect`
is now an alias of geom's `Rect`, which has the same shape. Badge's
`ChamferedRect` base uses the shared `polygonSampler` rather than a copy of it.
