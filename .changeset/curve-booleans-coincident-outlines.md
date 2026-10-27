---
'@weasel-js/geom': patch
---

The curve-preserving booleans and pieces no longer flatten when outlines coincide. Two inputs that share a stretch of one line or curve (a shape and a copy of it, the same circle drawn from another start point, two faces of a divide united back together, a rect along a half disk's straight side) are cut where the shared stretch starts and ends, and the pieces along it become one edge both inputs own, so the result keeps its curves. `pathUnion(a, a)` gives back `a`'s own cubics.
