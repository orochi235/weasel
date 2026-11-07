---
'@weasel-js/simulation': patch
---

A simulation on a clock whose `step` is 0, negative or not a number steps once per frame the clock moves. A `step` of 0 used to owe infinitely many steps on the first frame, which hung the page whenever `alphaTarget` kept the simulation warm, and a negative one owed a negative count.
