---
'@weasel-js/labkit': major
---

`seenFrom` is renamed `seenValues`: it snapshots the config values at the given keys.

```ts
// before
const seen = seenFrom(config, ['grid.size']);
// after
const seen = seenValues(config, ['grid.size']);
```

<!-- entry: breaking api -->
