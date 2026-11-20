---
'@weasel-js/core': patch
---

`writtenBy` rebuilds each op through the scene's own `opRegistry`, so a host-registered op is no longer applied to the recorder itself and a host override of a kit op name is read as the scene will commit it.

<!-- entry: fix -->
