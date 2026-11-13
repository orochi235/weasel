---
'@weasel-js/kernel3d': major
---

`createInsert` and `groundGridSource` take their viewport and up only from `world`; the deprecated `viewport` and `up` options are removed.

```ts
// before
createInsert({ viewport: world.viewport, up, mint });
groundGridSource({ step: 1, up });
// after
createInsert({ world, mint });
groundGridSource({ step: 1, world });
```

`groundGridSource`'s `world` needs only `up`, so a host with no viewport passes `{ up }`.

<!-- entry: breaking -->
