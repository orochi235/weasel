---
'@weasel-js/editor': major
---

A session entry is a value, not JSON text: `readStored` hands its reader the value, and `useAutosave` and `writeSession` store values.

Entries already in `localStorage` read as before. A snapshot holding typed arrays is written through core's `encodeSnapshot` and read back with `decodeSnapshot`. `writeSession` takes the entries first and `records` last, and resolves its answer; `onSaved` is called once a save's entries have landed or failed.

```ts
// before
readStored('myapp:doc', (raw) => parseDoc(JSON.parse(raw)), () => EMPTY);
useAutosave(() => ({ primary: ['myapp:scene', JSON.stringify(scene.toJSON(), serializeReplacer)] }));
const ok = writeSession(localStorage, primary, dependents);
// after
readStored('myapp:doc', parseDoc, () => EMPTY);
useAutosave(() => ({ primary: ['myapp:scene', encodeSnapshot(scene.toJSON())] }));
const ok = await writeSession(primary, dependents);
```

<!-- entry: breaking api -->
