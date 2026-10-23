---
"@weasel-js/core": patch
"@weasel-js/routing": patch
---

`startThresholdDrag` takes `captureAt: 'threshold'`, which leaves the pointer uncaptured until the press is a drag, so a press released short of the threshold still clicks what it was on; the capture it takes is released when the drag ends or is canceled. `modifiersOf`, which reads an event's modifier keys as a `ModifierState`, is exported from routing and core, for `keysHeld` to read a press.
