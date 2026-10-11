---
'@weasel-js/core': patch
---

A node added with `pickable: false` came back clickable after undoing a delete through `<SceneCanvas>`'s adapter, and a pasted copy of it was clickable too. `sceneToAdapter`'s `insertNode`, `snapshotSelection`, and `commitPaste` now carry the flag.
