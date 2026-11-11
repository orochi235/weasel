---
"@weasel-js/hud": patch
---

`createRect`, `createImage`, and `createButton` refuse a width or height of `NaN`, as they refuse one that is zero or negative. A `NaN` used to pass their check, since it compares false either way.
