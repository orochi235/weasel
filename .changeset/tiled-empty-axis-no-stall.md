---
'@weasel-js/parallax': patch
---

A tiled layer whose negative `bleed` leaves an axis with no copies draws nothing at once, instead of stalling a zoomed-out frame.

<!-- entry: fix perf -->
