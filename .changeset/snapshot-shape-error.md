---
"@weasel-js/core": patch
---

`sceneFromJSON`, `Scene.loadState` and `specsFromSerialized` refuse a malformed snapshot with a `SnapshotShapeError` naming what is wrong.

They check for a `nodes` and a `systemLayers` array, nodes that are objects with a string `id`, a known `kind`, a `layer` and a `pose`, a `parent`, `dependsOn`, flags and registry keys of the right type, and a `doc` that is an object. They used to throw a `TypeError` from wherever a missing field was first read.

<!-- entry: api fix -->
