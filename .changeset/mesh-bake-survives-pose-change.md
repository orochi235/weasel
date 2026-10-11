---
'@weasel-js/core': patch
---

A node filled with a bounds-relative mesh gradient (what `seedMeshPatch` and a stop-list conversion produce) re-baked and re-uploaded its texture on every frame of a move or resize, because the bake was cached against a copy of the paint that is rebuilt whenever the pose changes. The bake is now cached against the paint itself and reused while the node moves.
