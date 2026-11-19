---
'@weasel-js/diagram': major
---

`forceRelaxation` is `createForceRelaxation`, spelled like the other factories: it builds a simulation you tick yourself.

This is a breaking rename, with no alias, in both `@weasel-js/diagram` and `@weasel-js/diagram/layout`. Its arguments are unchanged.

```ts
// before
const relax = forceRelaxation(graph, { charge: -400 });
// after
const relax = createForceRelaxation(graph, { charge: -400 });
```

<!-- entry: breaking api -->
