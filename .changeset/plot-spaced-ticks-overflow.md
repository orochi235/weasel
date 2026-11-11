---
"@weasel-js/plot": patch
---

`spacedTicks` returns no ticks where `minSpacing` spans more of the domain than the largest double, instead of ticks at `NaN`.

<!-- entry: rank=-5 fix -->
