---
"@weasel-js/plot": patch
---

Linear, power, warp and time scales place a value when the domain's span, or the value's distance from its start, is past the double range.

`linearScale({ domain: [-Number.MAX_VALUE, Number.MAX_VALUE] }).map(0)` is the range's middle, and `invert` sends the range's ends to the domain's exactly. An xychart over values near `±Number.MAX_VALUE` draws its bars.

<!-- entry: rank=-5 fix -->
