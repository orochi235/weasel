---
'@weasel-js/core': minor
---

A scene document envelope saves a scene with its undo history, and the history restores only onto the scene it was saved beside.

`encodeSceneDocument(scene)` writes `{ format: 'weasel/scene-document', version: 1, scene, history }`, the history paired with a fingerprint of the scene; `decodeSceneDocument` reads one back, refusing anything else with a `SnapshotShapeError`. `restorePairedHistory(scene, history, options?)` restores it only when the scene's state has that fingerprint, answering `{ status: 'restored', report }` with `restoreHistory`'s report; otherwise it answers `{ status }` of `'mismatched'`, `'unpaired'` or `'stale'` and leaves the history as it was. `options` are `restoreHistory`'s, strict by default. `pairHistory(scene)` pairs a history kept apart from its scene.

```ts
const file = JSON.stringify(encodeSceneDocument(scene));
const doc = decodeSceneDocument(JSON.parse(file));
const loaded = sceneFromJSON(doc.scene, { registry });
restorePairedHistory(loaded, doc.history);
```

<!-- entry: rank=10 new api -->
