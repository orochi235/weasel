---
'@weasel-js/prefs-schema': major
'@weasel-js/prefs': major
---

`prefNumberAt` is renamed `prefBoundedNumber`: it takes a reader, not a path.

```ts
// before
const n = prefNumberAt(leaf, read);
// after
const n = prefBoundedNumber(leaf, read);
```

<!-- entry: breaking api -->
