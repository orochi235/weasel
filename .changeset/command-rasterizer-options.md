---
'@weasel-js/core': minor
---

`commandRasterizer` takes `screen` and `flattenTolerancePx` options. `screen` is where `'screen'`-unit paint is measured, and `flattenTolerancePx` is the curve tolerance in raster pixels.

```ts
commandRasterizer(session, { screen, flattenTolerancePx: 0.1 });
```

<!-- entry: api -->
