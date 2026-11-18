---
'@weasel-js/stroke': major
---

`insetPath` is renamed `trimPathEnds`: it cuts a length off each end of an open path, where "inset" elsewhere means an offset.

```ts
// before
const shaft = insetPath(path, start, end);
// after
const shaft = trimPathEnds(path, start, end);
```

<!-- entry: breaking api -->
