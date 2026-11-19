---
'@weasel-js/clock': patch
---

`declare` with no `speed` defaults it from the declared `rate`, as `createClock` does, rather than from the rate the clock is playing at.

<!-- entry: fix -->
