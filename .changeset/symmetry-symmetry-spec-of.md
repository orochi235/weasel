---
'@weasel-js/symmetry': major
---

`specOfData` is `symmetrySpecOf`: a group's `data` normalized into a `SymmetrySpec`.

```ts
// before
const spec = specOfData(node.data);
// after
const spec = symmetrySpecOf(node.data);
```

<!-- entry: breaking api -->
