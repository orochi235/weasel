---
"@weasel-js/plot": patch
---

Linear, power, warp, and time scales place a value when the domain's span, or the value's distance from its start, is past the double range: `linearScale({ domain: [-Number.MAX_VALUE, Number.MAX_VALUE] }).map(0)` is the range's middle, where it was its start, and an xychart over values near `±Number.MAX_VALUE` drew bars at `NaN`. `invert` sends the range's ends to the domain's exactly. `tickStep` no longer rounds a span near the largest double up to `Infinity`, which gave `NaN` ticks. Ticks finer than 1e-100 apart are no longer rounded onto 0, and their labels are written with an exponent (`1e-300`) rather than all reading `0`.
