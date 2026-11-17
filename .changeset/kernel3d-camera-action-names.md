---
'@weasel-js/kernel3d': major
---

kernel3d's camera actions are named for their `camera.*` ids.

`orbitAction`, `panAction`, `dollyAction`, `pinchDollyAction` and `homeAction` are `cameraOrbitAction`, `cameraPanAction`, `cameraDollyAction`, `cameraPinchDollyAction` and `cameraHomeAction`; their ids are unchanged.

```ts
// before
useAction(orbitAction);
// after
useAction(cameraOrbitAction);
```

<!-- entry: breaking api -->
