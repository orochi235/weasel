---
'@weasel-js/labkit': major
---

`autoPathsOf` is renamed `startAutoPathsOf`, since it lists the paths that start auto.

```ts
// before
const unpinned = autoPathsOf(resolved);
// after
const unpinned = startAutoPathsOf(resolved);
```

<!-- entry: breaking api -->
