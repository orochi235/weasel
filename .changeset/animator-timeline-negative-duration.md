---
"@weasel-js/animator": patch
---

A timeline with a negative `duration` plays as one of no length, its playhead at 0. Its `time()` and `duration()` read the negative number, and a seek landed there, though a playhead stands nowhere before 0.
