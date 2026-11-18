---
'@weasel-js/routing': major
'@weasel-js/core': major
---

`SWEEP_BINDING` is `SWEEP_SPEC`, since it is a gesture spec with no action rather than a binding.

```ts
// before
sweepAction({ binding: { ...SWEEP_BINDING, mods: { shift: true } } });
// after
sweepAction({ binding: { ...SWEEP_SPEC, mods: { shift: true } } });
```

<!-- entry: breaking api -->
