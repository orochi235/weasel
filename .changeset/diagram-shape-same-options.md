---
'@weasel-js/diagram': patch
---

`registerDiagramShape` and `registerMarkShape` called twice with the same options register one painter instead of throwing.

<!-- entry: fix -->
