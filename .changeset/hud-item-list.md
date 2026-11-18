---
'@weasel-js/hud': major
---

`hudList` is `hudItemList`, the HUD twin of the DOM's `domItemList`.

```ts
// before
hudList.measure(input, constraints, hudMeasureEnv(ctx));
// after
hudItemList.measure(input, constraints, hudMeasureEnv(ctx));
```

<!-- entry: breaking api -->
