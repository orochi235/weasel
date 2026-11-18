---
'@weasel-js/theme': patch
---

Theme token types, ramp steps, axes and modes named like `constructor` or `toString` now read as the theme's own data, never as built-ins.

`derive` colors a lightness ramp step named `toString`; `toDtcg` writes a token type named `constructor` and a mode named `toString` as groups of their own, and its override keys skip an axis named `constructor` a selection leaves out; `fromDtcg` gives a mode named `toString` an empty value when the axes extension leaves it out; `emitCss` scopes another theme's tokens by a default theme's axis named `toString` as by any other axis; and `pick` reads a selection without an axis named `constructor` as holding no value.

<!-- entry: fix -->
