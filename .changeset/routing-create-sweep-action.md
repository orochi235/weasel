---
'@weasel-js/routing': major
'@weasel-js/core': major
---

The sweep action's factory is `createSweepAction`, like the repo's other action factories.

`sweepAction` (routing, re-exported by core) is renamed `createSweepAction`; its options are unchanged.

```ts
// before
registry.register(sweepAction({ ...opts }));
// after
registry.register(createSweepAction({ ...opts }));
```

<!-- entry: breaking api -->
