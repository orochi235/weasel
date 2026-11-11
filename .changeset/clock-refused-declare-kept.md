---
"@weasel-js/clock": patch
---

A `declare` or `override` the clock refuses with a `RangeError` leaves the clock as it was. A declaration's own `duration` and `origin` are checked even while an override stands over them, so it throws at the `declare` rather than when the override is lifted.

<!-- entry: fix -->
