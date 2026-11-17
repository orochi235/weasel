---
'@weasel-js/paint': major
'@weasel-js/core': major
---

`GHOST_STROKE` is renamed `GHOST_STROKE_COLOR`: it is a color string, named like `DEFAULT_STROKE_COLOR` beside it.

```ts
// before
const stroke = solidStroke(GHOST_STROKE);
// after
const stroke = solidStroke(GHOST_STROKE_COLOR);
```

<!-- entry: breaking api -->
