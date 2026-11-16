---
'@weasel-js/registry': minor
---

New `createValueStore(initial, equal?)`: a store of one value that notifies only when a write changes it.

`equal` is `Object.is` by default; pass `sameList` or `deepEqual` for a value rebuilt on every write. Core's measurement cells (`MeasureCell`) are built on it.

<!-- entry: api -->
