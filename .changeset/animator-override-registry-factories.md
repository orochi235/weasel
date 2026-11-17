---
'@weasel-js/animator': major
---

Animator's override registries are built with `createColorOverrideRegistry()` and `createTrimOverrideRegistry()`, not `new`.

`ColorOverrideRegistry` and `TrimOverrideRegistry` are exported as types only.

```ts
// before
const colors = new ColorOverrideRegistry();
// after
const colors = createColorOverrideRegistry();
```

<!-- entry: breaking api -->
