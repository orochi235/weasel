---
'@weasel-js/forge': patch
---

`watchRecovery` with a `quietMs` past what one timer holds, `Infinity` among them, checks files only as they are served instead of every millisecond.

<!-- entry: fix -->
