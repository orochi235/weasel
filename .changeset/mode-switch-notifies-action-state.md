---
'@weasel-js/core': patch
---

A `<SceneCanvas modes>` switch now tells the dep registry, so an `ActionBar` or command palette greys out an action the new mode bars, and lights one it allows, without waiting for some other change to re-render it.

<!-- entry: fix -->
