---
'@weasel-js/editor': major
---

`serializeReplacer`, `reviveTypedArrays` and `snapshotValue` are removed: core's snapshot codec replaces them.

This is a breaking change. Encode with core's `encodeSnapshot` or `stringifySnapshot` and decode with `decodeSnapshot` or `parseSnapshot`; saved data reads as before.

```ts
// before
JSON.stringify(scene.toJSON(), serializeReplacer);
reviveTypedArrays(JSON.parse(text));
snapshotValue(scene.toJSON());
// after
stringifySnapshot(scene.toJSON());
parseSnapshot(text);
encodeSnapshot(scene.toJSON());
```

<!-- entry: breaking api -->
