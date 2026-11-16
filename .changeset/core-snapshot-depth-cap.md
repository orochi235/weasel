---
"@weasel-js/core": patch
---

`parseSnapshot` and `decodeSnapshot` refuse a snapshot nested past 1000 levels with a `SnapshotShapeError` instead of overflowing the stack.

<!-- entry: fix -->
