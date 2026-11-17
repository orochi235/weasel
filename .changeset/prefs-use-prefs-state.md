---
'@weasel-js/prefs': major
---

`usePrefsValues` is renamed `usePrefsState`: it returns the whole store as state, setters included.

```ts
// before
const { form } = usePrefsValues(store);
// after
const { form } = usePrefsState(store);
```

<!-- entry: breaking api -->
