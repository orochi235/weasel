---
"@weasel-js/plot": patch
---

A `logScale` whose ends are too near for their logarithms to differ maps them to the range's ends and gets no tick from outside it. Its `invert` at the range's ends stays finite.

<!-- entry: rank=-5 fix -->
