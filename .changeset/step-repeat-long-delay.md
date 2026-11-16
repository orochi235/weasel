---
'@weasel-js/ui-input': patch
---

`timerScheduler` waits out a delay longer than 2³¹ − 1 ms, and never runs on an infinite one, so a held stepper given such a `delayMs` or `everyMs` no longer repeats at once.

<!-- entry: fix -->
