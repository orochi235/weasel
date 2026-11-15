---
'@weasel-js/core': minor
---

Core encodes and decodes snapshots as JSON, typed-array path geometry included, with no other package.

`stringifySnapshot` and `parseSnapshot` (or `encodeSnapshot` and `decodeSnapshot`, for a JSON value rather than text) round-trip any snapshot, a path's typed arrays and data shaped like the codec's own tags included, and read the untagged path arrays older saves wrote. An encoded snapshot is typed `Encoded<T>`, apart from the snapshot it encodes. `snapshotReplacer` is the replacer for a larger payload holding snapshots. The codec is also published as `@weasel-js/core/json`, which loads without React.

```ts
localStorage.setItem('myapp:scene', stringifySnapshot(scene.toJSON()));
const loaded = sceneFromJSON(parseSnapshot(localStorage.getItem('myapp:scene')!));
```

<!-- entry: rank=10 new api -->
