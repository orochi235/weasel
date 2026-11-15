---
'@weasel-js/editor': major
---

`useSessionPersistence` restores an undo stack only onto the scene it was saved beside, and drops its `pages` option.

This is a breaking change. The stack is saved paired with the scene (core's `encodeSceneDocument`) and restored through `restorePairedHistory`, so one beside a scene that loaded otherwise, rebuilt, migrated by the app, unreadable or replaced, is dropped; `pages` only decided that, and goes. A stack saved before this release is unpaired and is dropped once. `loadHistory` returns the stored value as saved.

```ts
// before
useSessionPersistence(scene, { sceneKey, historyKey, pages });
// after
useSessionPersistence(scene, { sceneKey, historyKey });
```

<!-- entry: breaking api behavior data -->
