---
'@weasel-js/core': minor
'@weasel-js/editing': minor
'@weasel-js/path-tools': patch
---

The `insert` dep's `build` hands back a node factory's `batch` options and `inserted` hook, and the pen's join honors both.

`build` now returns `{ id, ops, batch?, inserted? }`. A caller applying the ops runs them inside `scene.batch(label, apply, batch)` when `batch` is set, and calls `inserted()` once they have applied.

<!-- entry: api fix -->
