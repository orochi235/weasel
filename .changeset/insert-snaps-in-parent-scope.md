---
"@weasel-js/core": patch
"@weasel-js/guides": patch
"@weasel-js/kernel3d": patch
---

Drawing or click-placing a node into a container with a unit scope now snaps on that scope's grid
pitch, not the root's.

- `SnapBegin` and `SnapCollect` take `parent`: the container a subject not yet in the scene lands
  in. `insertAction` and `placeAction` pass the container the `insertInto` dep names, the same one
  the `insert` dep puts the node in; an id naming no container passes nothing.
- `gridSnapSource({ scopes })` reads the scope from `ids` when the gesture has a subject, else from
  `parent`, else the root.
- kernel3d's `createSnap` passes `parent` on to its sources, as it does `ids`.
- `placeAction` now requires the `insertInto` and `scene` deps, both optional.
