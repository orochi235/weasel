---
'@weasel-js/font': major
---

`outlineMetrics` is `outlineFace`, named for the `OutlineFace` it returns.

```ts
// before
const face = outlineMetrics(family, 400, 'normal');
// after
const face = outlineFace(family, 400, 'normal');
```

<!-- entry: breaking api -->
