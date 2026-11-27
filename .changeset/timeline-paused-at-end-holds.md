---
'@weasel-js/animator': patch
---

A paused timeline seeked to its end, or made paused with no length, waits there until it plays. The event at its end then fires, and `onDone` runs.

<!-- entry: fix -->
