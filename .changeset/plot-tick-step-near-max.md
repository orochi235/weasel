---
"@weasel-js/plot": patch
---

`tickStep` no longer rounds a span near the largest double up to `Infinity`, so such a scale's ticks are finite.

<!-- entry: rank=-5 fix -->
