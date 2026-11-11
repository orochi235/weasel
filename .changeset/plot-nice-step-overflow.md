---
"@weasel-js/plot": patch
---

`niceStep` keeps a rough step whose rounding up would pass the largest double, so `spacedTicks` over the whole double range gives finite ticks.

<!-- entry: rank=-5 fix -->
