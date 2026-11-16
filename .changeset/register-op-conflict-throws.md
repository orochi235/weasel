---
'@weasel-js/core': major
---

`scene.registerOp` throws when a different handler takes a kind already registered, unless it passes `{ replace: true }`.

This is breaking: a second handler used to replace the first silently. Registering the same handler again is still no change. Code that swaps a handler on purpose, as hot reload does, says so:

```ts
scene.registerOp('app:bump', handler, { replace: true });
```

<!-- entry: breaking api behavior -->
