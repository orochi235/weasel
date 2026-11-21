---
'@weasel-js/renderer': minor
'@weasel-js/text-tools': minor
'@weasel-js/svg': patch
---

A blurred drop shadow fills its interior with its full color, as an unblurred one does. This holds for HUD box shadows and text shadows too, on canvas and in SVG export.

`dropShadowLayers` returns `alphas`, the opacity of each path, and `TextFrame.shadow` carries the same; the single `alpha` and `opacity` they replace are deprecated.

<!-- entry: fix visual api deprecates -->
