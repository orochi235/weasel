---
'@weasel-js/clock': patch
---

`declare` without a `speed` defaults it from the spec's `rate`, as `createClock` does. Re-declaring a spec leaves a transport's play speed alone.

<!-- entry: fix -->
