---
"@weasel-js/ui-logic": patch
---

`envPx` reads a px length whose number CSS writes with a sign, an exponent, or an upper-case unit: `+4px`, `1e-7px`, `2PX`, and `1e+21px`, which is how JavaScript writes `${n}px` for a number that large or that small. It threw on them, as on a token that was no length at all. A unitless zero is any spelling of zero, as `0.0`; a length past the double range still reads as none.
