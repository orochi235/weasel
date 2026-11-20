---
'@weasel-js/core': patch
---

A `usePoseRun` whose `step` throws ends the run as `cancel()` would, so `isRunning()` reads `false` and `start()` begins a new run.

<!-- entry: fix -->
