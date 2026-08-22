---
'@weasel-js/audio': patch
---

`BusHandle` reads back: `gain()`, `muted()`, `soloed()` and `audible()`

The handle was write-only, so anything rendering a mixer strip kept a parallel
copy of every bus's state and hoped it stayed in step with the graph. The
getters read the live state, so a handle held across a `setGain` reports the new
value.

`audible()` is the effective answer — unmuted, and soloed if any bus is soloed —
because a solo elsewhere silences a bus without muting it, and `muted()` and
`soloed()` together cannot tell you that. It shares the rule with the graph's
own recomputation rather than restating it.
