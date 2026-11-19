---
'@weasel-js/clock': patch
---

Reset on a `start: 'end'` clock made endless goes to the end of its declared run instead of throwing.

That covers a loop toggle, a `duration` write and an override that make the run endless.

`declare` on such a clock now throws a `RangeError` on a declaration whose run never ends, as `createClock` does for the same spec, and keeps the last declaration.

<!-- entry: fix behavior -->
