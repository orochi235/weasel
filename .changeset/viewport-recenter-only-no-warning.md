---
'@weasel-js/core': patch
---

`<SceneCanvas>` no longer warns that `viewport` configures viewPreset when the only field set is `recenter`, which reaches the view dep without viewPreset.

<!-- entry: fix -->
