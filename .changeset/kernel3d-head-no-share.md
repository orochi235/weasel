---
"@weasel-js/kernel3d": patch
---

`headFor` gives a head whose `maxShare` is 0 no length when the line's length is left out, as it does for a line of any finite length. It answered `NaN` for its length, its half-base, and the shaft's width.
