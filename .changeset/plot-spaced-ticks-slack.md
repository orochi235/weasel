---
"@weasel-js/plot": patch
---

`spacedTicks` gives no tick past the domain where its step is far wider than the domain. The rounding room it left each end was a share of the step, so a domain of -3715146.8 to -1 spaced on a step of 1e9 took in 0.
