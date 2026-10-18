---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

A puppet warp bends through the shape rather than across the plane. The shape's fill is triangulated with its outline as triangle edges (`puppetMesh`) and deformed as-rigid-as-possible (`createArapSolver`), so two limbs that nearly touch no longer move together when a pin on one is dragged. Both linear systems are factored once per pin set; a drag frame only re-solves them.

Breaking: the warp API moved out of the root `@weasel-js/geom` entry into a new `@weasel-js/geom/warp` entry, because a puppet needs the optional `earcut` peer to triangulate. `pathWarpMap` now takes the source path as its second argument, and `rigidPuppetMap` is gone; `puppetMap(source, pins)` replaces it.
