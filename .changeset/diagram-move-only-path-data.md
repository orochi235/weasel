---
'@weasel-js/diagram': patch
---

`outlineFromD` throws on path data that only moves, such as `'M0.5 0.5'`. A drawn mark given such data warns.

<!-- entry: fix behavior -->
