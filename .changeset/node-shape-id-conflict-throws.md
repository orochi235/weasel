---
'@weasel-js/core': major
---

Registering a node-shape painter under an `id` a different painter already holds in that registry throws, unless it passes `{ replace: true }`.

This is breaking: both painters used to stay live, and the older one kept painting. The same painter registered again is still a second registration. Code that swaps a painter on purpose, as hot reload does, says so:

```ts
registerNodeShape(painter, { replace: true });
```

<!-- entry: breaking api behavior -->
