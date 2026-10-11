---
'@weasel-js/core': patch
---

Internal: `<Canvas>`'s scene-layer builders and its view state moved out of `Canvas.tsx` into modules of their own. `buildSceneLayer`, `buildSceneLayers`, and `SceneSlotConfig` are still exported from where they were. No behavior change.
