---
'@weasel-js/animator': patch
---

One event track nested twice at the same time in a booked timeline books each placement's events, as it fires each, and each up to its own nested timeline's end.

<!-- entry: fix -->
