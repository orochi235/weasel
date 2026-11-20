---
'@weasel-js/core': major
'@weasel-js/path-tools': major
---

Functions that place a node in world take the whole scene, as a node under a container needs.

They are `nodeFrameOf`, `shownNodeOf`, `storesEdits`, `ownGeometryAt`, and path-tools' `brokenConstraintLink`, `brokenConstraintLinks` and `constraintLinkConflictsOf`.

This is breaking for a caller that passed an object with only a few of the scene's methods: one with a node under a container threw. Pass the scene itself.

```ts
// before
shownNodeOf({ get: (id) => scene.get(id) }, id);
// after
shownNodeOf(scene, id);
```

<!-- entry: breaking fix -->
