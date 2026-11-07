---
'@weasel-js/plot': patch
---

A linear scale over a domain finer than about 1e-20 put every tick at 0 and labeled each one `0`, and a log scale labeled its ticks below 1e-20 `0`: tick values and labels were rounded to at most 20 decimals. They now round to as many as `toFixed` allows, 100.
