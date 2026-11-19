---
'@weasel-js/core': patch
---

A `<SceneCanvas scene>` changed from a live `Scene` to JSON keeps the live scene and warns. Give the canvas a new `key` to load the JSON.

<!-- entry: fix -->
