---
'@weasel-js/core': major
---

A scene that keeps adding and removing nodes keeps painting past 16.7 million node ids, where it used to throw.

Once `scenePickIds` has handed out every number an id frame can hold, it gives a removed node's number to a new node. A number read from an id frame before its node was removed can then name a different node. Until that point nothing changes. `nodeOf` now answers `null` for a node that has left the scene:

```ts
const n = scenePickIds(scene).idOf(id);
scene.remove(id);
scenePickIds(scene).nodeOf(n); // before: id; now: null
```

A number you keep across removals should be checked with `nodeOf` before use, not trusted for the scene's life.

<!-- entry: breaking behavior fix -->
