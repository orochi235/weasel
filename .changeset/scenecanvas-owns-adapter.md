---
'@weasel-js/core': patch
---

`<SceneCanvas>` now builds its adapter with `useSceneAdapter` and keeps the same adapter across renders unless one of its inputs changes; it used to build a new one on every render. Moving a container still moves its children, now through `sceneToAdapter`'s `cascadeContainerPose` rather than a second copy of that logic.

`useSceneAdapter` now passes `poseComposition` through to `sceneToAdapter`. It used to drop it, so the adapter it returned ignored the frame model. The undo entry `cascadeContainerPose` records for a container move is now labeled `move container` rather than `setPose`, the label `<SceneCanvas>` already used.
