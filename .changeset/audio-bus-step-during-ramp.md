---
'@weasel-js/audio': patch
---

`BusHandle.setGain(v)` with no ramp steps the bus to `v` at once, even while a ramp to `v` is in flight.

<!-- entry: fix -->
