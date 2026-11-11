---
"@weasel-js/plot": patch
---

`spacedTicks` returns no ticks where `minSpacing` spans more of the domain than the largest double, rather than ticks at `NaN`: a domain of 1e308 laid in one pixel with ticks two pixels apart.
