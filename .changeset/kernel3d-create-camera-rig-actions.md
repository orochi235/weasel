---
'@weasel-js/kernel3d': major
---

`cameraRigActions` is `createCameraRigActions`, spelled like the other factories.

```ts
// before
const actions = cameraRigActions({ drag: true });
// after
const actions = createCameraRigActions({ drag: true });
```

<!-- entry: breaking api -->
