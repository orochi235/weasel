---
'@weasel-js/core': patch
'@weasel-js/renderer': patch
'@weasel-js/svg': patch
'@weasel-js/hud': patch
---

A text node with a `background` can now draw an `edge`, a rule just inside its box in its background's color mixed toward black (`{ width, shade }`), and a `shadow` under it (`{ x, y, blur, alpha }`). The edge keeps the background's hue when the background changes. Sticky notes now have both by default. `textFrameOf` describes the frame once; the canvas painter and the SVG export both draw from it. The renderer's new `dropShadowLayers` and `dropShadowCommand` build a shadow as stacked translucent shapes with no blur pass, and hud's `box-shadow` now draws through them.
