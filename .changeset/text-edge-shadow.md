---
'@weasel-js/core': patch
'@weasel-js/renderer': patch
'@weasel-js/svg': patch
'@weasel-js/hud': patch
---

A text node with a `background` can draw an `edge` and a `shadow`, and sticky notes have both by default.

`edge` (`{ width, shade }`) is a rule just inside the box in the background's color mixed toward black, keeping the background's hue when it changes; `shadow` (`{ x, y, blur, alpha }`) draws under it. `textFrameOf` describes the frame once, and the canvas painter and the SVG export both draw from it. The renderer's new `dropShadowLayers` and `dropShadowCommand` build a shadow as stacked translucent shapes with no blur pass, and hud's `box-shadow` now draws through them.

<!-- entry: rank=10 new api visual -->
