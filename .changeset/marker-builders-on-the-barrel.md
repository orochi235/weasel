---
'@weasel-js/core': patch
---

Export the marker path builders — `circlePath`, `squarePath` and
`rectMarkerPath` — from `@weasel-js/core`, and add `roundRectPath` beside them.
They are the shared math for selection chrome, anchor markers and rubber-band
rects; until now a consumer building overlay chrome had to reimplement the
circle sample loop.

`markers.ts` also carried a `linePath(ax, ay, bx, by)` that built the identical
open two-vertex `PolygonPath` as the already-public `linePath(a, b)` from
`builder.ts`. Rather than rename one to clear the collision on the barrel, the
duplicate is deleted and its callers now use the point-taking public one — two
spellings of one function is the thing worth removing, not the name clash.
