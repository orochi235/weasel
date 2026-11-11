---
"@weasel-js/audio": patch
---

A delay insert, and `delayNode`, throw their own `RangeError` for a longest time of 180000 ms or more or one that rounds to no time at all in seconds. Both were handed to `createDelay`, which a browser refuses with its own `NotSupportedError`; `delayNode({ time: 200000 })` reached it through its default.
