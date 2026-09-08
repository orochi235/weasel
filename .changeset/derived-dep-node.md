---
'@weasel-js/core': patch
---

A derivation now receives its dependencies as `{ node, pose }` rather than as
bare poses. Breaking for anything with a `derivePath` or `derivePose`: read
`deps[0]?.pose` where it read `deps[0]`.

A connector legitimately reads more than a box — one that thickens with its
endpoint's weight, or routes only to nodes on a given layer, is answering off
`data` and `layer`. The scene has invalidated dependents on `kit:setData` and
`kit:setLayer` since those landed, and `scene.ts` said in a comment that a
derivation "is handed its dependencies' nodes, not only their poses". It was
not: the invalidation was paying for a read the signature could not perform.

`scenePoseLookup` is now `sceneDepLookup` and answers `DerivedDep` for the same
reason. `DerivedDep` is exported.
