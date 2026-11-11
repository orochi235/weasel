---
"@weasel-js/audio": patch
---

A delay insert and `delayNode` throw a `RangeError` for a longest time they cannot hold. That is 180000 ms or more, or a time that rounds to nothing in seconds; the browser's `NotSupportedError` no longer reaches the caller.

<!-- entry: rank=-5 fix -->
