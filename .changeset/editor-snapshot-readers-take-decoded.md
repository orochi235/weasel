---
'@weasel-js/editor': major
---

`nodeSpecsFromSnapshot` and `docFromSnapshot` read a decoded snapshot, and decode nothing themselves.

This is a breaking change. `nodeSpecsFromSnapshot`'s third argument is that migration, none by default. Decode a stored value with core's `decodeSnapshot` before reading it; a migration no longer decodes typed arrays itself.

```ts
// before
nodeSpecsFromSnapshot(JSON.parse(text), registry, (data) => upgrade(reviveTypedArrays(data)));
// after
nodeSpecsFromSnapshot(parseSnapshot(text), registry, upgrade);
```

<!-- entry: breaking api -->
