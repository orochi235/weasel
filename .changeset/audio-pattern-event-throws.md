---
'@weasel-js/audio': patch
---

A pattern player keeps playing past an event that throws at its play call: the rest of that step sounds and later steps are booked.

Such an event is one with an unreadable pitch or an unknown bus, say. The error still reaches the console through the scheduler.

<!-- entry: fix -->
