---
'@weasel-js/routing': patch
---

A `startThresholdDrag` whose `onStart` calls `cancel()` reports only the cancel. No `onMove` or `onEnd` follows for the event that crossed the threshold.

<!-- entry: fix -->
