---
'@weasel-js/editor': major
---

`nodeSpecsFromSnapshot` and `docFromSnapshot` read a decoded snapshot, and `nodeSpecsFromSnapshot`'s third argument is the application's own data migration, none by default.

This is a breaking change. Decode a stored value with core's `decodeSnapshot` before reading it; a migration no longer decodes typed arrays itself.

```ts
// before
nodeSpecsFromSnapshot(JSON.parse(text), registry, (data) => upgrade(reviveTypedArrays(data)));
// after
nodeSpecsFromSnapshot(parseSnapshot(text), registry, upgrade);
```

<!-- entry: breaking api -->
