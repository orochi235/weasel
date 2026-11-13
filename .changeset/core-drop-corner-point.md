---
'@weasel-js/core': major
---

core's deprecated `cornerPoint` is removed; use `handlePoint`, which takes the same arguments and also places edge handles.

```ts
// before
const p = cornerPoint(bounds, anchor);
// after
const p = handlePoint(bounds, anchor);
```

<!-- entry: breaking -->
