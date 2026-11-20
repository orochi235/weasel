---
'@weasel-js/core': major
---

`<SceneCanvas>` drops `gestureSource`, `previewPoseExtra` and `boundsOfPose`, which replaced the ones it wires itself.

Code passing one of them stops typechecking; drop the prop. Passing one left the selection chrome and `viewBounds: 'content'` blind to in-flight gestures. To box nodes differently, give `geometry.boundsOf`, which the chrome and the pickers both read.

<!-- entry: fix breaking -->
