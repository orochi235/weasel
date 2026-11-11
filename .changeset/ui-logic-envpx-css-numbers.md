---
"@weasel-js/ui-logic": patch
---

`envPx` reads a px length written with a sign, an exponent or an upper-case unit, such as `+4px`, `1e+21px` or `2PX`, rather than throwing.

A unitless zero is any spelling of zero, such as `0.0`; a length past the double range still reads as none.

<!-- entry: rank=-5 fix -->
