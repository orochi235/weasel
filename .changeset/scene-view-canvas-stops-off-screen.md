---
'@weasel-js/core': patch
---

`<SceneViewCanvas>` and `<MinimapCanvas>` stop painting while the canvas is scrolled out of view, as `<SceneCanvas>` and `<DrawCanvas>` already did. A minimap given the main canvas's `animator` repainted on every tick with nothing on screen to show for it. The held repaint lands when the canvas comes back. Their docs also no longer claim that `className` sizes the canvas: the renderer writes the `width` and `height` props as inline style, which a class cannot override.
