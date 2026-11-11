---
"@weasel-js/audio": patch
---

Waiting on the audio clock for a time more than about 24.8 days ahead asks its timer for at most 2³¹ − 1 ms, the longest a timer takes. It asked for the whole wait, which a browser or Node fires at once, so the wait rechecked the clock every millisecond.
