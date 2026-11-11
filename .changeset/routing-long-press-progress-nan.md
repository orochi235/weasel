---
'@weasel-js/routing': patch
---

A held press's `progress()` reads 0 at a clock or start that is not a number, rather than `NaN`, so it always lies
between 0 and 1.
