---
"@weasel-js/kernel3d": minor
---

`createInsert`'s `viewport` and `up` options and `groundGridSource`'s `up` are deprecated in favor of `world`; they still work.

Each is a second place to name the world's up beside `World3d.up`, and the two can disagree:

```ts
createInsert({ world, mint });
groundGridSource({ step: 1, world });
```

<!-- entry: deprecates -->
