---
'@weasel-js/audio': patch
---

A worklet noise voice with a negative rate plays its loop backwards, as a noise voice on nodes does, rather than adding `NaN` to its bus.

<!-- entry: fix -->
