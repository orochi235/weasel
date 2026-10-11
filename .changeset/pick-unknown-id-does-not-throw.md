---
'@weasel-js/core': patch
---

When a `geometry.pickEvery` override on `<SceneCanvas>` answered an id the scene does not hold, hovering or clicking that point threw `sceneToAdapter: unknown node`. The hit is now reported with `kind: 'unknown'`.
