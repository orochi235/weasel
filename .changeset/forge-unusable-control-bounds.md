---
'@weasel-js/forge': patch
---

A Storybook number control with unusable bounds gets an unbounded control, and a warning naming it.

An endless, unreadable or reversed `min`/`max` no longer fails every story in its file. forge warns about any
bounds it cannot use, a lone `min` or `max` included, naming the control.

<!-- entry: fix -->
