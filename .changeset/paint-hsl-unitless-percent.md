---
"@weasel-js/paint": patch
---

`parseColor` reads a unitless `hsl()` saturation or lightness on the percent scale, as CSS Color 4 does: `hsl(120 50 50)` is `hsl(120 50% 50%)`, where it used to clamp to white.
