---
'@weasel-js/plot': patch
---

`ticks()` on a linear, log, or time scale whose domain reached `Infinity`, or a linear scale spanning more than `Number.MAX_VALUE` (say `-1e308..1e308`), never returned. They now return no ticks for an infinite domain and a few for a vast finite one. A time scale reaching back before the year 100 also placed its first ticks in the 1900s, out of order, because `Date.UTC` reads years 0 to 99 as 1900 to 1999.
