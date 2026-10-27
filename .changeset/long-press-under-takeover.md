---
'@weasel-js/core': patch
---

`<SceneCanvas>` installs its long-press feedback beside a `tools` takeover too, as it does the view marker drag: the ring shows for a held press whether or not the consumer's own `useTools` lists it. A takeover whose ambient already holds an entry of the same id keeps its own and gets no second one.
