---
'@weasel-js/geom': major
'@weasel-js/core': major
---

`scalePathToBounds` is renamed `fitPathToRect`: it scales and translates a path so its bounds land on the target rect.

```ts
// before
const fitted = scalePathToBounds(path, target);
// after
const fitted = fitPathToRect(path, target);
```

<!-- entry: breaking api -->
