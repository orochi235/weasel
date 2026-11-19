---
'@weasel-js/core': patch
---

A render worker frame whose scene changes fail to apply still takes its view, size and animator calls. The page sends the whole scene next.

<!-- entry: fix -->
