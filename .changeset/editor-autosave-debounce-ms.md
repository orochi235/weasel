---
'@weasel-js/editor': major
---

`useAutosave`'s delay is `debounceMs`, as storage's record cache names it, and `useSessionPersistence` takes it too.

```ts
// Before
useAutosave(write, { delayMs: 1000 });

// After
useAutosave(write, { debounceMs: 1000 });
useSessionPersistence(scene, { sceneKey, historyKey, debounceMs: 1000 });
```

<!-- entry: breaking api -->
