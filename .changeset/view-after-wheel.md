---
'@weasel-js/core': major
---

`computeWheelAction` is `viewAfterWheel`, since it returns the next view after one wheel sample.

```ts
// before
const next = computeWheelAction(view, input);
// after
const next = viewAfterWheel(view, input);
```

<!-- entry: breaking api -->
