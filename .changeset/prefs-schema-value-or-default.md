---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
---

`prefLeafValue` is renamed `prefValueOrDefault`: it returns the held value, else the leaf's default.

```ts
// before
const shown = prefLeafValue(leaf, held);
// after
const shown = prefValueOrDefault(leaf, held);
```

<!-- entry: breaking api -->
