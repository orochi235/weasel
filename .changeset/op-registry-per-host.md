---
'@weasel-js/core': major
---

Each scene or history can restore ops through an op registry of its own, so two hosts can give one op name different factories.

This is a breaking change. `createOpRegistry()` makes a registry that falls back to the kit's built-in factories; `createScene({ opRegistry })` and `createHistory(adapter, { opRegistry })` restore through it, and through `defaultOpRegistry` when none is given. `registerOpFactory` writes to `defaultOpRegistry`, returns its release, and throws on a different factory under a taken name unless passed `{ replace: true }`. `opFactoryRegistry`, `rebuildOp` and `registeredOpNames` are gone.

```ts
// before
registerOpFactory('app:recolor', buildRecolor);
rebuildOp('app:recolor', args);
registeredOpNames();
// after
const ops = createOpRegistry();
ops.register('app:recolor', buildRecolor);
const scene = createScene({ systemLayers, opRegistry: ops });
ops.rebuild('app:recolor', args);
ops.entries().map((e) => e.key);
```

<!-- entry: rank=10 breaking api -->
