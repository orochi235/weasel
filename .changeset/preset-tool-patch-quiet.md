---
'@weasel-js/core': patch
---

`<SceneCanvas tools>` no longer warns when a patch tool replaces one a preset brings — a custom `hand` under the `view` preset, say. That replacement is the documented way to restyle a preset's tool, and the patched tool still takes the preset tool's place in the palette. The dev warning now fires only when the id is also listed in `defaultTools`, where asking for the built-in and replacing it in the same breath is likely a mistake. Since 1.11.0 the warning reached npm consumers in development (earlier builds shipped it disabled), and it logged on every render.
