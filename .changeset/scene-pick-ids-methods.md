---
'@weasel-js/core': major
---

`ScenePickIds`' `idOf` and `nodeOf` are `pickIdOf` and `idOfPickId`: one gives the pick number for a node id, the other the node id for a pick number.

```ts
// before
const node = scenePickIds(scene).nodeOf(pixel);
// after
const node = scenePickIds(scene).idOfPickId(pixel);
```

<!-- entry: breaking api -->
