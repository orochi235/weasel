---
'@weasel-js/stroke': major
---

`strokeSpaceOf` is renamed `strokeMetricOf`: it splits a linear map into its scale and its stroke metric, and returns `{ scale, metric }`.

```ts
// before
const { scale, metric } = strokeSpaceOf(m[0], m[1], m[3], m[4]);
// after
const { scale, metric } = strokeMetricOf(m[0], m[1], m[3], m[4]);
```

<!-- entry: breaking api -->
