---
'@weasel-js/core': patch
---

A `<SceneCanvas>` inside a `useSceneTextEdit` container leaves out the glyphs of the node being edited, as its own editor does.

An `alphaFor` or `layers.scene.drawOne` written to hide the node during an edit is no longer needed.

<!-- entry: fix visual -->
