---
'@weasel-js/core': patch
---

`styleAtRange` compared two class instances in a run's `fill` or `stroke`, such as two `Date`s, as equal whenever neither had own enumerable keys. They now compare by identity, so a range holding both reads `MIXED`.
