---
"@weasel-js/core": patch
---

`sceneFromJSON`, `Scene.loadState`, and `specsFromSerialized` refuse a snapshot of the wrong shape (no `nodes` or `systemLayers` array, a node that is not an object or has no string `id`, an unknown `kind`, no `layer` or `pose`, a `parent`, `dependsOn`, flag, or registry key of the wrong type, a `doc` that is not an object) with a `SnapshotShapeError` naming what is wrong. They threw a `TypeError` from wherever the missing field was first read.
