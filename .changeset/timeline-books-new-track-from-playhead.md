---
'@weasel-js/animator': patch
---

An event track added by `edit` to a booked timeline books its events from the playhead on.

The same holds for a nested track moved to a new `at`; events behind the playhead are no longer booked at once.

<!-- entry: fix -->
