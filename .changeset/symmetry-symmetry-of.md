---
'@weasel-js/symmetry': major
---

`readGroup` is `symmetryOf`: the symmetry spec and world center of a symmetry group, or null.

```ts
// before
const g = readGroup(scene, id);
// after
const g = symmetryOf(scene, id);
```

<!-- entry: breaking api -->
