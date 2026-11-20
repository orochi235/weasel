---
'@weasel-js/core': patch
---

A journal opened on `scene.history` refuses `applyOps` inside `scene.untracked`, as `scene.history.applyOps` does.

<!-- entry: fix -->
