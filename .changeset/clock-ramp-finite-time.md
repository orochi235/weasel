---
'@weasel-js/clock': patch
---

`clock.ramp(to, over)` throws a `RangeError` when `over` is not finite. A ramp over `Infinity` never
arrived, so the clock never went inert and kept the frame loop running at a rate that never moved;
`NaN` silently set the rate at once. An `over` of 0 or less still sets the rate at once.
