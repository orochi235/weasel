---
'@weasel-js/ui': patch
---

`AnimatedTimeline` redraws its lanes after an edit. A key dragged to a new time went on being drawn where it started, and the next drag or arrow-key step began from the old time, because the handle edits its track array in place and `Timeline` builds its rows once per array. `AnimatedTimeline` now hands `Timeline` a fresh array for every edit the handle reports.
