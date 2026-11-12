---
'@weasel-js/core': minor
---

A snapshot in an unsupported version throws `SnapshotShapeError`; one naming an unregistered key throws the new `SnapshotKeyError`.

`SnapshotKeyError` carries the node `id`, the registry `field` and the `key`, so a caller can offer to load again with `unknownKeys: 'skip'`. A later version is now refused for its version before any of its nodes are read.

<!-- entry: api fix -->
