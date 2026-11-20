---
'@weasel-js/labkit': patch
---

`JobProgress` stops sweeping when a job that never reported a total ends: its bar shows full once the job is done and empty if it failed.

<!-- entry: fix visual -->
