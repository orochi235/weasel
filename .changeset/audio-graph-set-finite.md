---
"@weasel-js/audio": patch
---

An audio graph's `set` throws a `RangeError` for a value or ramp that is not finite, whether or not the node is sounding. A stopped source kept the value to hand its next node, so `set('osc', 'frequency', NaN)` succeeded and the next `start()` threw partway through starting the graph.
