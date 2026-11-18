---
'@weasel-js/prefs': major
---

`leafIsAtReset` is renamed `readingIsAtReset` and `leafAtReset` is renamed `sourceLeafIsAtReset`, so the two names no longer differ by one letter.

```ts
// before
leafIsAtReset(leaf, reading); leafAtReset(source, path, leaf);
// after
readingIsAtReset(leaf, reading); sourceLeafIsAtReset(source, path, leaf);
```

<!-- entry: breaking api -->
