---
'@weasel-js/labkit': patch
---

`useFrameSchedule` runs every function handed to it before the next frame, so two clone sources can share one schedule.

<!-- entry: fix -->
