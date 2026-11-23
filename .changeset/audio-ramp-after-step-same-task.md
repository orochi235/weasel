---
'@weasel-js/audio': patch
---

A gain ramp asked for right after `play`, or right after a step write in the same task, fades from the level just set rather than from the param's old value.

<!-- entry: fix -->
