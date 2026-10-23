---
"@weasel-js/core": patch
---

`startThresholdDrag` takes `captureAt: 'threshold'`, which leaves the pointer uncaptured until the press is a drag, so a press released short of the threshold still clicks what it was on.
