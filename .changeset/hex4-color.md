---
'@weasel-js/core': patch
---

`toHex8` left a 4-digit hex color (`#f008`) unexpanded, so `getAlpha01` read its alpha as 1, `withAlpha01` returned it untouched, and `paintWithColor` kept the old paint's opacity on top of the color's own alpha. `#rgba` now expands to `#rrggbbaa`.
