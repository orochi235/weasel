---
'@weasel-js/audio': patch
---

`createDelayEffect` given a `maxTime` under 250 ms and no `time` opens the line at `maxTime`, rather than throwing on its own default.

<!-- entry: fix -->
