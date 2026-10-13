---
'@weasel-js/core': patch
---

A kit canvas brings its own size rule. `<Canvas>`, `<SceneViewCanvas>`, and `<DrawCanvas>` used to take their CSS size from a class in `@weasel-js/core/style.css`, so a page that did not load that stylesheet showed each one at its drawing buffer's size, `dpr` times too large. Each canvas now adopts the one rule into the document or shadow root it mounts in, so a popout window and a shadow root are covered too. The rule keys on a `data-wzl-surface` attribute at zero specificity, as before, so a class passed to the canvas still resizes it. The rule is gone from `style.css`, and the canvas no longer carries the kit's `surface` class.
