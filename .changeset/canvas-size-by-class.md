---
'@weasel-js/renderer': patch
'@weasel-js/core': patch
'@weasel-js/minimap': patch
---

Breaking: `WeaselRenderer` no longer writes `width` and `height` as inline style on a canvas it is given, at construction or in `resize`. It sets the drawing buffer and nothing else, so a caller that hands it a canvas, or calls `renderSceneToCanvas`, sizes the element itself.

Breaking: `<SceneCanvas>`, `<SceneViewCanvas>`, `<DrawCanvas>`, and `<MinimapCanvas>` size their canvas through a class in `@weasel-js/core/style.css`, which a page now has to import for a canvas to be the right size. Without it the element is as large as its drawing buffer: twice too large at a device pixel ratio of 2. The class has no specificity, so a `className` whose rule sets `width` or `height` now resizes the element, where the inline style used to win. A rule that was written that way and never took effect starts to.
