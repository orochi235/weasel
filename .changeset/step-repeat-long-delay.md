---
'@weasel-js/ui-input': patch
---

`timerScheduler` waits out a delay past 2³¹ − 1 ms and never runs on an infinite one, so a held stepper no longer repeats at once.

<!-- entry: fix -->
