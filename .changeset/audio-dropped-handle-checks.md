---
"@weasel-js/audio": patch
---

The handle of a voice dropped at the call, because the engine was disposed or its context not yet running, refuses what a live handle refuses: a gain, fade, rate, detune, pan, or position that is not finite throws a `RangeError`. Its setters accepted anything, so a bad value threw or not depending on whether the voice had played.
