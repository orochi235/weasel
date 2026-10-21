---
"@weasel-js/paint": patch
"@weasel-js/labkit": patch
"@weasel-js/forge": patch
---

`parseColor` reads `color(srgb …)`, `color(srgb-linear …)`, `oklab()` and `oklch()`, clamping the OK spaces into sRGB. A browser computes every `color-mix()` to `color(srgb …)`, so the workshop's Token readout no longer reports such a color as unreadable.

A workshop lens shows the new story after a switch to another one, where it showed "Nothing under the reticle" until something else changed, and a Live lens shows a component's index page. A Pixels lens captures a story whose config holds unset (undefined) args, which it refused as unsendable.

A lens body takes resize handles at its corners only. A round body resized into an ellipse clips its view to that ellipse, inside its rim, where the view covered all but two slivers of the rim.
