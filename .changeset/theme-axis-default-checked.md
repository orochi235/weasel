---
'@weasel-js/theme': patch
---

`defineTheme` and `fromDtcg` throw on an axis whose default is not one of its values.

A DTCG document with no base theme and no `dark` mode defaults to its first mode.

<!-- entry: fix behavior -->
