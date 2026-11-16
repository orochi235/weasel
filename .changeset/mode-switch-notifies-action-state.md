---
'@weasel-js/core': patch
---

A `<SceneCanvas modes>` switch tells the dep registry, so action bars and the palette reread which actions it allows.

Before, an `ActionBar` showed the previous mode's state until some other change re-rendered it.

<!-- entry: fix -->
