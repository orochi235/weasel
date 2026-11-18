---
'@weasel-js/modes': major
---

`getActiveModeFor` is `createActiveModeReader`, since it builds a memoized reader rather than returning the active mode.

```ts
// before
const readMode = getActiveModeFor(registry);
// after
const readMode = createActiveModeReader(registry);
```

<!-- entry: breaking api -->
