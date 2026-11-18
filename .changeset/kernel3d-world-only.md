---
'@weasel-js/kernel3d': major
---

`createInsert3dDep` and `groundGridSource` take their viewport and up only from `world`; the deprecated `viewport` and `up` options are removed.

```ts
// before
createInsert3dDep({ viewport: world.viewport, up, mint });
groundGridSource({ step: 1, up });
// after
createInsert3dDep({ world, mint });
groundGridSource({ step: 1, world });
```

<!-- entry: breaking -->
