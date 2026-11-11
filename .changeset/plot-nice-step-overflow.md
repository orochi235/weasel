---
"@weasel-js/plot": patch
---

`niceStep` keeps a rough step whose rounding up would pass the largest double, rather than answering `Infinity`, so `spacedTicks` over a domain as wide as the double range gives finite ticks rather than `NaN`.
