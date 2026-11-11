---
"@weasel-js/hud": patch
---

A HUD window ignores a drag's move to a point that is not finite, and reports no content click for a release at one. A move to `NaN` used to set its bounds to `NaN` for good, and to `Infinity` to fling it off the canvas.
