---
'@weasel-js/stroke': major
---

`dashLength` is renamed `dashRunLength`: it is the length a dash pattern runs along the whole path, not the length of a dash.

```ts
// before
const length = dashLength(path);
// after
const length = dashRunLength(path);
```

<!-- entry: breaking api -->
