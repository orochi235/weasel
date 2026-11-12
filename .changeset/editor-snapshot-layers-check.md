---
'@weasel-js/editor': minor
---

`nodeSpecsFromSnapshot` takes `systemLayers`, and with it throws on a snapshot a scene of those layers cannot hold.

That is a node on a layer the scene lacks, or under a parent the snapshot does not have. Read the snapshot inside `readStored` with the layers your scene is built with, and a saved document the app cannot open falls back and is kept aside instead of failing `useScene` on every reload:

```ts
readStored(KEY, (raw) => nodeSpecsFromSnapshot(JSON.parse(raw), REGISTRY, reviveTypedArrays, { systemLayers: LAYERS }), starter);
```

<!-- entry: api fix -->
