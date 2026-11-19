---
'@weasel-js/core': major
---

`sceneSession2d` is `createSceneSession2d`, spelled like `createSnapSession2d` and the other factories.

This is a breaking rename, with no alias. It takes the same `SceneSessionInputs` and returns the same `SnapSession`.

```ts
// before
const session = sceneSession2d(inputs);
// after
const session = createSceneSession2d(inputs);
```

<!-- entry: breaking api -->
