---
'@weasel-js/kernel3d': major
---

`CameraRigGestures`' `home` option is `doubleClick`, named for its gesture like `drag`, `wheel`, `trackpadPinch` and `touchPinch`.

```ts
// before
cameraRig(camera3d, { home: false });
// after
cameraRig(camera3d, { doubleClick: false });
```

<!-- entry: breaking api -->
