---
"@weasel-js/ui-logic": patch
---

A `frames` sweep of a run that ends always shows the run's end as its last frame. Where the last frame's time rounded past the end, as a 2000 ms run walked 500 ms apart does when both carry float drift, the end was dropped.
