---
'@weasel-js/core': patch
---

`<SceneCanvas actions>` overrides reach a tool's or a preset's own actions. They also stay in force when an action re-registers, as `viewport.zoom` does when its `viewport` config changes.

<!-- entry: fix -->
