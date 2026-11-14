---
'@weasel-js/editor': minor
---

An editor's session can be kept in IndexedDB, or any `RecordCache`, through the `records` option of its session hooks and readers.

`useSessionPersistence`, `useAutosave`, `readStored`, and `writeSession` take it. Open the records before the scene is made; their reads are synchronous once open, and the keys become the records' names. Without `records`, the hooks keep the session in `localStorage` as before.

```tsx
const records = await openRecords({ storage: indexedDbAdapter, prefix: 'myapp:' });
const saved = readStored('scene', readScene, () => EMPTY, records);
// …
useSessionPersistence(scene, { sceneKey: 'scene', historyKey: 'history', records });
```

<!-- entry: rank=10 new api -->
