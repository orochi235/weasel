---
"@weasel-js/hud": patch
---

`createRect`, `createImage` and `createButton` refuse a width or height of `NaN`, as they refuse zero or negative ones.

<!-- entry: rank=-5 fix -->
