---
'@weasel-js/routing': patch
---

`swallowClick` and `swallowNextClick` stop the swallowed click reaching any other listener on the target, capture listeners added after the guard included.

<!-- entry: fix -->
