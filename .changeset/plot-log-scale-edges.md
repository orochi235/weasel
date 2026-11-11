---
"@weasel-js/plot": patch
---

`logScale` keeps about twice the tick count across many decades, every few decades, where it gave one tick a decade. A domain whose ends are too near for their logarithms to differ maps them to the range's ends rather than both to its middle, and gets no tick from outside it. `invert` at the range's ends no longer overflows to `Infinity` or 0. Small ticks of a base other than 10 are labeled to their own digits, where values like 1.09e-12 and 1.2e-12 both read `0.000000000001`.
