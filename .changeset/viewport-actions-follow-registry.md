---
"@weasel-js/core": patch
---

`<SceneCanvas>`'s wheel and pinch actions follow the actions registry in scope when it changes, as under an `<InputScope>` handed a new `yoke`.

<!-- entry: fix -->
