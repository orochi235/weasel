---
"@weasel-js/kernel3d": minor
---

`createInsert` takes a `world`, so a drag inserts on the ground its world's `up` names, where the world's snap and camera already were.

```ts
createInsert({ world, mint });
```

Passing `world` reads its `viewport` and `up`. The `viewport` and `up` form stays for a host with no `World3d`; the two cannot be mixed.

<!-- entry: api fix -->
