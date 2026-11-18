---
'@weasel-js/geom': major
'@weasel-js/core': major
---

`pathInPoseFrame` is renamed `pathInPoseBox`: it rebases a path onto the pose box and applies no frame, which `pathThroughPoseFrame` does.

```ts
// before
const local = pathInPoseFrame(path, pose);
// after
const local = pathInPoseBox(path, pose);
```

<!-- entry: breaking api -->
