---
'@weasel-js/core': patch
'@weasel-js/animator': patch
---

Depends on `@msb235/blits` 0.18.0, up from 0.16.1. Neither release breaks anything the kit calls. Among their fixes: a seek back now finds a voice that an earlier forward seek played to its end, so scrubbing back over a finished effect shows it again; and a voice's `seek` throws a `RangeError` for a time that is not a finite number, where a `NaN` time used to leave the voice showing nothing.
