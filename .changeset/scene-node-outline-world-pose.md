---
'@weasel-js/core': major
---

`sceneNodeOutline` gives a paged or nested node's outline where it is drawn, and takes the scene itself.

```ts
// before: any `{ get(id) }` was accepted, and the outline sat at the stored pose
sceneNodeOutline({ get: (id) => scene.get(id) }, id);
// after: pass the scene; the outline is in world space
sceneNodeOutline(scene, id);
```

<!-- entry: breaking fix -->
