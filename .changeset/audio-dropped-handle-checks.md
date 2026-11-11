---
"@weasel-js/audio": patch
---

A dropped voice's handle throws a `RangeError` for a non-finite gain, fade, rate, detune, pan or position, as a live handle does. A voice is dropped at the call when the engine was disposed or its context was not yet running.

<!-- entry: rank=-5 fix -->
