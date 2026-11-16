---
'@weasel-js/forge': patch
---

`watchRecovery` given a `quietMs` too long for one timer, such as `Infinity`, checks files only as they are served, not every millisecond.

<!-- entry: fix -->
