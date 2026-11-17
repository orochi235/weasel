---
'@weasel-js/scale': major
---

`ContinuousScale.map` is gone; call `position`, which every scale answers and which `map` only repeated.

`OrdinalScale.map` stays.

```ts
// before
const at = x.map(25);
// after
const at = x.position(25);
```

<!-- entry: breaking api -->
