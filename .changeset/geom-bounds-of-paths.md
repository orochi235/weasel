---
'@weasel-js/geom': major
'@weasel-js/core': major
---

`unionBoundsPath` is renamed `boundsOfPaths`, the plural of `boundsOfPath`.

```ts
// before
const box = unionBoundsPath([a, b]);
// after
const box = boundsOfPaths([a, b]);
```

<!-- entry: breaking api -->
