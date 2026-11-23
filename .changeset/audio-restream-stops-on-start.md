---
'@weasel-js/audio': patch
---

`engine.stream` stops an element's earlier stream when the new one starts, so one stopped or dropped first leaves it playing.

<!-- entry: fix -->
