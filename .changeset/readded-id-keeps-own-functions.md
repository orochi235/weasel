---
'@weasel-js/core': patch
---

A node added under an id a removed node had used came back with that node's `clipFromPose`, `derivePath`, `derivePose`, or `layout` when its own spec set none, and `toJSON` wrote the old key for it. `reconcileSpecs` hit this whenever a spec dropped one of those fields. `scene.add` now attaches only what its spec carries, and undo and redo give each add of an id back its own functions.
