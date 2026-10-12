---
'@weasel-js/core': patch
---

Fixes: `renderDebugSnapshot` threw "sourceRect.height must be a positive finite number" for a y-up view (`view.scale.y < 0`), so a flipped canvas could not be rasterized headlessly. It now renders what that canvas showed.

Changes behavior: `renderSceneToPixels`, `planPixelRender`, and a raster session's `render` take a negative `scale` axis, where they used to throw. A negative axis is flipped: the output is sized from the scale's magnitude, and the source rect's far edge on that axis lands on the output's top or left. `sourceRect` is unchanged, a positive-size rect either way, and a zero or non-finite scale still throws.
